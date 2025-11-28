'use client';

import React, { useState, useEffect, useRef } from 'react';

// 型定義
type QueryItem = { name: string; weight: number };
type ResultItem = { id: number; score: number; name?: string };

export default function Home() {
  // --- State管理 ---
  // 入力フォーム用
  const [inputName, setInputName] = useState('');
  const [inputWeight, setInputWeight] = useState<number>(1.0);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // サーバー(C++)の準備状態
  const [serverReady, setServerReady] = useState(false);
  
  // クエリリストと結果
  const [queryItems, setQueryItems] = useState<QueryItem[]>([]);
  const [results, setResults] = useState<ResultItem[]>([]);
  
  // 調整パラメータ (-1.0 ~ 1.0)
  const [cParam, setCParam] = useState<number>(0.0);
  // adjust request state: whether a request is in-flight and a pending value
  const adjustingRef = useRef(false);
  const pendingCRef = useRef<number | null>(null);
  // ref to the Node Name input so we can focus it when a top-node is clicked
  const nameInputRef = useRef<HTMLInputElement | null>(null);
  // clamp limits for C: avoid exactly -1 or +1
  const CLAMP_MAX = 0.9999;
  const clampC = (v: number) => {
    if (!Number.isFinite(v)) return 0;
    return Math.max(-CLAMP_MAX, Math.min(CLAMP_MAX, v));
  };
  
  // UI状態
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // --- サジェスト機能 ---
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (inputName.length < 2) {
        setSuggestions([]);
        return;
      }
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(inputName)}`);
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data);
        }
      } catch (e) {
        console.error(e);
      }
    };

    // デバウンス処理（入力停止後300msで検索）
    const timer = setTimeout(fetchSuggestions, 300);
    return () => clearTimeout(timer);
  }, [inputName]);

  useEffect(() => {
      // コンポーネントマウント時に1回だけ実行
      const waitForServer = async () => {
        try {
          // このfetchは、サーバーの準備ができるまでレスポンスが返ってこない(Pendingになる)
          // そのため、ここで await していればよい
          await fetch('/api/status');
          
          // レスポンスが返ってきた＝準備完了
          setServerReady(true);
        } catch (e) {
          console.error("Connection failed", e);
          // エラー時の再試行ロジックが必要ならここに記述
        }
      };

      waitForServer();
    }, []); // 依存配列は空

  // --- ハンドラ ---
  
  // リストに追加
  const handleAddItem = async () => {
    if (!inputName) return;

    try {
      // Validate the name exists by querying the suggest API for exact match
      const res = await fetch(`/api/suggest?q=${encodeURIComponent(inputName)}`);
      if (!res.ok) {
        setError('Name validation failed');
        return;
      }
      const data = await res.json();
      // suggest returns names matching the prefix; require exact match
      const exists = Array.isArray(data) && data.includes(inputName);
      if (!exists) {
        setError(`"${inputName}" not found in database`);
        return;
      }

      setQueryItems([...queryItems, { name: inputName, weight: inputWeight }]);
      setInputName(''); // クリア
      setInputWeight(1.0); // リセット
      setError('');
    } catch (e) {
      console.error('Add validation error', e);
      setError('Validation error');
    }
  };

  // リストから削除
  const handleRemoveItem = (index: number) => {
    const newItems = [...queryItems];
    newItems.splice(index, 1);
    setQueryItems(newItems);
  };

  // Stage 1: 解析実行
  const handleAnalyze = async () => {
    if (queryItems.length === 0) return;
    setLoading(true);
    setError('');
    setCParam(0.0); // パラメータリセット

    try {
      // タイムアウト付き（30秒）のfetch
      const controller = new AbortController();
      const timeoutMs = 30000; // 30秒
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: queryItems }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      // レスポンスをまずテキストで受け取り、JSONパースを安全に行う
      const text = await res.text();
      if (!res.ok) {
        setError(`Server Error ${res.status}: ${text}`);
      } else {
        try {
          const data = JSON.parse(text);
          // C++ 実装は成功時に配列を返す（例: [{id:..., score:...}, ...]）
          if (Array.isArray(data)) {
            setResults(data as any);
          } else if (data && data.status === 'ok') {
            setResults(data.top_nodes || []);
          } else if (data && (data.error || data.message)) {
            setError(data.error || data.message);
          } else {
            setError('Analysis failed: unexpected response');
          }
        } catch (e) {
          setError(`Invalid JSON response: ${text}`);
        }
      }
    } catch (e) {
      if ((e as any)?.name === 'AbortError') {
        setError('Request timed out (30s)');
      } else {
        setError('Network error');
      }
    } finally {
      setLoading(false);
    }
  };

  // Stage 2: パラメータ調整 (スライダー操作時)
  // Sending of `c` values is serialized: while a request is in-flight,
  // subsequent slider changes are stored (only the latest) and will be
  // sent after the current response returns.
  const sendAdjust = async (c: number) => {
    // ensure server never receives exact -1 or +1
    const cToSend = clampC(c);
    adjustingRef.current = true;
    try {
      const controller = new AbortController();
      const timeoutMs = 30000;
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ c: cToSend }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const text = await res.text();
      if (!res.ok) {
        console.error(`Adjust server error ${res.status}: ${text}`);
      } else {
        try {
          const data = JSON.parse(text);
          if (Array.isArray(data)) {
            setResults(data as any);
          } else if (data && data.status === 'ok') {
            setResults(data.top_nodes || []);
          } else {
            console.error('Adjust response error', data);
          }
        } catch (e) {
          console.error('Adjust invalid JSON', text);
        }
      }
    } catch (e) {
      if ((e as any)?.name === 'AbortError') {
        console.error('Adjustment request timed out');
      } else {
        console.error('Adjustment error', e);
      }
    } finally {
      adjustingRef.current = false;
      // If a new value was requested while we were waiting, pick the latest
      const pending = pendingCRef.current;
      pendingCRef.current = null;
      if (pending !== null) {
        const pendingClamped = clampC(pending);
        if (pendingClamped !== cToSend) {
          // send the latest pending adjustment
          await sendAdjust(pendingClamped);
        }
      }
    }
  };

  const handleAdjust = (newC: number) => {
    const clamped = clampC(newC);
    setCParam(clamped);
    if (results.length === 0) return;

    if (adjustingRef.current) {
      // store latest requested value and return; it will be sent later
      pendingCRef.current = clamped;
      return;
    }

    // No request in-flight: start sending
    void sendAdjust(clamped);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1 style={{ borderBottom: '2px solid #333', paddingBottom: '0.5rem' }}>Graph Analysis Demo</h1>

      {/* --- 入力エリア --- */}
      <div style={{ background: '#fff', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
        <h3>1. Query Builder</h3>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', marginBottom: '1rem' }}>
          
          {/* ノード名入力 (サジェスト付き) */}
          <div style={{ flex: 2 }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Movie Name</label>
            <input
              type="text"
              list="suggestions-list" // datalistと連携
              ref={nameInputRef}
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              placeholder="Type movie name (e.g. Matrix)..."
              style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', height: '40px', boxSizing: 'border-box' }}
            />
            <datalist id="suggestions-list">
              {suggestions.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          {/* 重み入力 */}
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 'bold' }}>Weight</label>
            <input
              type="number"
              step="0.1"
              value={inputWeight}
              onChange={(e) => setInputWeight(parseFloat(e.target.value))}
              style={{ width: '100%', padding: '0.5rem', fontSize: '1rem', height: '40px', boxSizing: 'border-box' }}
            />
          </div>

          <button
            onClick={handleAddItem}
            style={{ height: '40px', padding: '0 1.2rem', background: '#0070f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            Add
          </button>
        </div>

        {/* 選択済みリスト */}
        {queryItems.length > 0 && (
          <div style={{ marginTop: '1rem', background: '#f5f5f5', padding: '1rem', borderRadius: '4px' }}>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {queryItems.map((item, idx) => (
                <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ddd', padding: '0.5rem 0' }}>
                  <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                    <b>{item.name}</b>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <label style={{ fontSize: '0.85rem', color: '#444' }}>Weight</label>
                      <input
                        type="number"
                        step="0.1"
                        value={Number.isFinite(item.weight) ? item.weight : 0}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          const newItems = [...queryItems];
                          newItems[idx] = { ...newItems[idx], weight: Number.isFinite(v) ? v : 0 };
                          setQueryItems(newItems);
                        }}
                        disabled={loading}
                        title={loading ? 'Cannot change weight while analysis is running' : undefined}
                        style={{ width: '80px', padding: '0.25rem', fontSize: '0.95rem' }}
                      />
                    </div>
                  </div>
                  <button onClick={() => handleRemoveItem(idx)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}>✕</button>
                </li>
              ))}
            </ul>
            <div style={{ marginTop: '1rem', textAlign: 'right' }}>
              <button
                onClick={handleAnalyze}
                // ローディング中、またはサーバー準備未完了なら無効化
                disabled={loading || !serverReady} 
                style={{ 
                  padding: '0.8rem 2rem', 
                  // 色を変えて無効状態をわかりやすくする
                  background: !serverReady ? '#ccc' : (loading ? '#88cf88' : '#28a745'), 
                  color: 'white', 
                  border: 'none', 
                  borderRadius: '4px', 
                  fontSize: '1rem', 
                  cursor: (loading || !serverReady) ? 'not-allowed' : 'pointer',
                  transition: 'background 0.3s'
                }}
              >
                {!serverReady 
                  ? 'Loading Graph...'   // 準備中
                  : loading 
                    ? 'Analyzing...'     // 解析中
                    : 'Run Analysis'     // 実行可能
                }
              </button>
            </div>
          </div>
        )}
      </div>

      {/* エラー表示 */}
      {error && <div style={{ color: 'red', marginTop: '1rem', padding: '1rem', background: '#ffe6e6' }}>Error: {error}</div>}

      {/* --- 結果 & 調整エリア --- */}
      {results.length > 0 && !loading && (
        <div style={{ marginTop: '2rem', background: '#fff', padding: '1.5rem', borderRadius: '8px', boxShadow: '0 2px 5px rgba(0,0,0,0.1)' }}>
          
          {/* Stage 2: パラメータ調整 */}
          <div style={{ marginBottom: '2rem', padding: '1rem', background: '#eef', borderRadius: '4px' }}>
            <h3>2. Post-Process Adjustment</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <span style={{ fontWeight: 'bold' }}>
                  Parameter: {Number.isFinite(cParam) ? cParam.toFixed(2) : '—'}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
                  <span style={{ fontSize: '0.9rem', color: '#444', whiteSpace: 'nowrap' }}>Minor (−1)</span>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.01"
                    value={cParam}
                    onChange={(e) => handleAdjust(parseFloat(e.target.value))}
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontSize: '0.9rem', color: '#444', whiteSpace: 'nowrap' }}>Major (+1)</span>
                </div>
              </div>

              <p style={{ fontSize: '0.9rem', color: '#666', marginTop: '0.25rem' }}>
                Move the slider to emphasize different content types after analysis. Values near <b>+1</b> highlight more <b>major</b> or central content; values near <b>−1</b> highlight more <b>minor</b> or peripheral content.
              </p>

              <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
                Tip: drag to the right (towards <b>Major</b>) to surface prominent nodes, or to the left (towards <b>Minor</b>) to surface less prominent ones.
              </p>
            </div>
          </div>

          {/* 結果リスト */}
          <h3>Top Nodes</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f0f0f0', textAlign: 'left' }}>
                <th style={{ padding: '0.5rem' }}>Rank</th>
                <th style={{ padding: '0.5rem' }}>Node ID</th>
                <th style={{ padding: '0.5rem' }}>Score</th>
              </tr>
            </thead>
            <tbody>
              {results.map((res, idx) => (
                <tr key={res.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '0.5rem' }}>{idx + 1}</td>
                  <td style={{ padding: '0.5rem' }}>
                    {res.name ? (
                      <button
                        onClick={() => {
                          const name = res.name ?? '';
                          if (!name) return;
                          setQueryItems((prev) => {
                            const exists = prev.some((p) => p.name === name);
                            if (exists) {
                              // already selected: do nothing
                              return prev;
                            }
                            // add new item with weight 1
                            return [...prev, { name, weight: 1 }];
                          });
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0,
                          fontSize: '1rem',
                          textDecoration: 'underline'
                        }}
                      >
                        {res.name}
                      </button>
                    ) : (
                      res.id
                    )}
                  </td>
                  <td style={{ padding: '0.5rem', color: '#0070f3', fontWeight: 'bold' }}>
                    {Number.isFinite(res.score) ? res.score.toFixed(4) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}