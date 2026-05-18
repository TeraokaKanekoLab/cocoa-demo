'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import ReactMarkdown from 'react-markdown';

import LanguageSwitcher from '@/components/LanguageSwitcher';

// 型定義
type QueryItem = { name: string; weight: number };
type ResultItem = { id: number; score: number; name?: string; title_ja?: string | null; ranking?: number | null };
type BlacklistEntry = { id: number; name?: string };
const MARKDOWN_LIST_COLOR_CLASSES = '[&>li:nth-child(1)]:text-indigo-700 [&>li:nth-child(2)]:text-teal-700 [&>li:nth-child(3)]:text-sky-700';

// セクション別テーマカラー定義（見出し、スコア、タイトル用）
const SECTION_THEME_COLORS = [
  { text: 'text-indigo-700', bg: 'bg-indigo-100' },
  { text: 'text-teal-700', bg: 'bg-teal-100' },
  { text: 'text-rose-700', bg: 'bg-rose-100' },
  { text: 'text-orange-700', bg: 'bg-orange-100' },
  { text: 'text-violet-700', bg: 'bg-violet-100' },
];

export default function Home() {
  const t = useTranslations('Home');
  const locale = useLocale();

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
  // Groq analysis UI state
  const [groqLoading, setGroqLoading] = useState(false);
  const [groqError, setGroqError] = useState('');
  const [groqOutput, setGroqOutput] = useState('');
  const [aiSelection, setAiSelection] = useState<string>('groq:openai/gpt-oss-20b');
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
  
  // セクション追跡用のref（MovieAnalysisセクション内の見出し数をカウント）
  const sectionColorIndexRef = useRef(0);

  // --- サジェスト機能 ---
  useEffect(() => {
    const fetchSuggestions = async () => {
      if (inputName.length < 2) {
        setSuggestions([]);
        return;
      }
      try {
        const res = await fetch(`/api/suggest?q=${encodeURIComponent(inputName)}&locale=${locale}`);
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
  }, [inputName, locale]);

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
        console.error('Connection failed', e);
        // エラー時の再試行ロジックが必要ならここに記述
      }
    };

    void waitForServer();
  }, []); // 依存配列は空

  // groqOutputが更新されたときにセクション追跡をリセット
  useEffect(() => {
    sectionColorIndexRef.current = 0;
  }, [groqOutput]);

  // --- ハンドラ ---

  // リストに追加
  const handleAddItem = async () => {
    const normalizedName = inputName.trim();
    if (!normalizedName) {
      setError(t('errors.emptyMovieName'));
      return;
    }

    if (queryItems.some((item: QueryItem) => item.name === normalizedName)) {
      setError(t('errors.duplicate', { name: normalizedName }));
      return;
    }

    try {
      // Validate the name exists by querying the suggest API for exact match
      const res = await fetch(`/api/suggest?q=${encodeURIComponent(normalizedName)}&locale=${locale}`);
      if (!res.ok) {
        setError(t('errors.nameValidationFailed'));
        return;
      }
      const data = await res.json();
      // suggest returns names matching the prefix; require exact match
      const exists = Array.isArray(data) && data.includes(normalizedName);
      if (!exists) {
        setError(t('errors.notFoundInDb', { name: normalizedName }));
        return;
      }

      setQueryItems([...queryItems, { name: normalizedName, weight: inputWeight }]);
      setInputName(''); // クリア
      setInputWeight(1.0); // リセット
      setError('');
    } catch (e) {
      console.error('Add validation error', e);
      setError(t('errors.validationError'));
    }
  };

  // リストから削除
  const handleRemoveItem = (index: number) => {
    const newItems = [...queryItems];
    newItems.splice(index, 1);
    setQueryItems(newItems);
  };

  const handleResultSelection = (res: ResultItem) => {
    const displayName = locale === 'ja' ? (res.title_ja ?? res.name) : res.name;
    if (!displayName) return;
    setQueryItems((prev: QueryItem[]) => {
      if (prev.some((item: QueryItem) => item.name === displayName)) {
        return prev;
      }
      return [...prev, { name: displayName, weight: 1 }];
    });
  };

  const handleBlacklistAdd = (res: ResultItem) => {
    if (typeof res.id !== 'number') return;
    const displayName = locale === 'ja' ? (res.title_ja ?? res.name) : res.name;
    setBlacklist((prev: BlacklistEntry[]) => {
      if (prev.some((entry) => entry.id === res.id)) {
        return prev;
      }
      return [...prev, { id: res.id, name: displayName }];
    });
  };

  const handleBlacklistRemove = (id: number) => {
    setBlacklist((prev: BlacklistEntry[]) => prev.filter((entry: BlacklistEntry) => entry.id !== id));
  };

  // Stage 1: 解析実行
  const handleAnalyze = async () => {
    if (queryItems.length === 0) return;
    setLoading(true);
    setError('');
    setCParam(0.0);
    setGroqOutput('');
    setGroqError('');
    const blacklistIds = Array.from(new Set(blacklist.map((entry: BlacklistEntry) => entry.id)));

    try {
      // タイムアウト付き（30秒）のfetch
      const controller = new AbortController();
      const timeoutMs = 30000; // 30秒
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      const startTime = performance.now();
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: queryItems, blacklistIds, locale }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const duration = ((performance.now() - startTime) / 1000);
      console.log(`Initial analysis request took ${duration} seconds`);

      // レスポンスをまずテキストで受け取り、JSONパースを安全に行う
      const text = await res.text();
      if (!res.ok) {
        setError(t('errors.serverError', { status: res.status, text }));
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
            setError(t('errors.analysisUnexpected'));
          }
        } catch (e) {
          setError(t('errors.invalidJson', { text }));
        }
      }
    } catch (e) {
      if ((e as any)?.name === 'AbortError') {
        setError(t('errors.requestTimeout'));
      } else {
        setError(t('errors.networkError'));
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

      const startTime = performance.now();
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ c: cToSend }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const duration = ((performance.now() - startTime) / 1000);
      console.log(`Adjust request with c=${cToSend} took ${duration} seconds`);

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

  const selectedNames = new Set(queryItems.map((item: QueryItem) => item.name));
  const getDisplayName = (res: ResultItem) => (locale === 'ja' ? (res.title_ja ?? res.name) : res.name);
  const blacklistIdSet = new Set(blacklist.map((entry: BlacklistEntry) => entry.id));
  const visibleResults = results
    .filter((res: ResultItem) => !blacklistIdSet.has(res.id))
    .filter((res: ResultItem) => {
      const displayName = getDisplayName(res);
      return !displayName || !selectedNames.has(displayName);
    })
    .slice(0, 10);

  // --- Groq Explain: send ranking + names/scores to /api/groq ---
  const handleGroqExplain = async () => {
    if (visibleResults.length === 0) return;
    setGroqLoading(true);
    setGroqError('');
    setGroqOutput('');

    const [providerRaw, modelRaw] = aiSelection.split(':');
    const provider = providerRaw || 'openai';
    const model = modelRaw || 'gpt-5-mini';

    try {
      const payload = {
        locale,
        rankings: visibleResults.map((r) => ({ name: getDisplayName(r) ?? String(r.id), score: r.score })),
        favoriteMovies: queryItems.map((q) => q.name),
        provider,
        model,
      };

      const startTime = performance.now();
      const res = await fetch('/api/groq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const duration = ((performance.now() - startTime) / 1000)
      console.log(`Groq explain request took ${duration} seconds`);

      if (!res.ok) {
        const text = await res.text();
        setGroqError(t('errors.serverError', { status: res.status, text }));
      } else if (!res.body) {
        setGroqError(t('errors.networkError'));
      } else {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const handleSsePayload = (payloadText: string) => {
          try {
            const payload = JSON.parse(payloadText);
            if (payload?.error) {
              setGroqError(String(payload.error));
              return;
            }
            if (typeof payload?.delta === 'string') {
              setGroqOutput((prev) => prev + payload.delta);
            }
          } catch (e) {
            console.error('Failed to parse SSE payload', { payloadText, error: e });
            setGroqError(t('errors.networkError'));
          }
        };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const chunks = buffer.split('\n\n');
          buffer = chunks.pop() ?? '';

          for (const chunk of chunks) {
            const lines = chunk.split('\n');
            for (const line of lines) {
              if (line.startsWith('data: ')) {
                handleSsePayload(line.slice(6));
              }
            }
          }
        }

        if (buffer.startsWith('data: ')) {
          handleSsePayload(buffer.slice(6));
        }
      }
    } catch (e) {
      console.error('Groq request failed', e);
      setGroqError(t('errors.networkError'));
    } finally {
      setGroqLoading(false);
    }
  };

  const trimmedInputName = inputName.trim();
  const isAddDisabled = !trimmedInputName || queryItems.some((item: QueryItem) => item.name === trimmedInputName);
  const addButtonClass = [
    'h-10 rounded-lg px-5 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60',
    isAddDisabled ? 'bg-sky-400' : 'bg-sky-600 hover:bg-sky-700',
  ].join(' ');
  const runAnalysisButtonClass = [
    'rounded-lg px-6 py-2 text-white transition disabled:cursor-not-allowed disabled:opacity-70',
    !serverReady ? 'bg-slate-400' : loading ? 'bg-lime-600' : 'bg-emerald-500 hover:bg-emerald-600',
  ].join(' ');

  return (
    <div className="mx-auto max-w-4xl p-8 font-sans">
      <div className="flex items-start justify-between gap-4 border-b-2 border-slate-800 pb-3">
        <h1 className="text-3xl font-semibold">{t('title')}</h1>
        <LanguageSwitcher />
      </div>

      {/* --- 入力エリア --- */}
      <div className="mt-8 rounded-xl bg-white p-6 shadow">
        <h3 className="text-xl font-semibold">{t('sections.queryBuilder')}</h3>
        <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end">
          {/* ノード名入力 (サジェスト付き) */}
          <div className="flex-1">
            <label className="mb-2 block text-sm font-semibold uppercase tracking-wide text-slate-600">
              {t('labels.movieName')}
            </label>
            <input
              type="text"
              list="suggestions-list"
              ref={nameInputRef}
              value={inputName}
              onChange={(e) => setInputName(e.target.value)}
              placeholder={t('placeholders.movieName')}
              className="h-10 w-full rounded-lg border border-slate-300 px-3 text-base shadow-sm transition focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
            <datalist id="suggestions-list">
              {suggestions.map((s: string) => (
                <option key={s} value={s} />
              ))}
            </datalist>
          </div>

          {/* 重み入力 */}
          <div className="w-full md:w-40">
            <label className="mb-2 block text-sm font-semibold uppercase tracking-wide text-slate-600">
              {t('labels.weight')}
            </label>
            <input
              type="number"
              step="1"
              value={inputWeight}
              onChange={(e) => setInputWeight(parseFloat(e.target.value))}
              className="h-10 w-full rounded-lg border border-slate-300 px-3 text-base shadow-sm transition focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
            />
          </div>

          <button onClick={handleAddItem} disabled={isAddDisabled} className={addButtonClass}>
            {t('buttons.add')}
          </button>
        </div>

        {/* 選択済みリスト */}
        {queryItems.length > 0 && (
          <div className="mt-6 rounded-lg bg-slate-100 p-4">
            <ul className="divide-y divide-slate-200">
              {queryItems.map((item: QueryItem, idx: number) => (
                <li key={idx} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex flex-wrap items-center gap-4">
                    <b className="text-slate-800">{item.name}</b>
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      {t('labels.weight')}
                      <input
                        type="number"
                        step="1"
                        value={Number.isFinite(item.weight) ? item.weight : 0}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          const newItems = [...queryItems];
                          newItems[idx] = { ...newItems[idx], weight: Number.isFinite(v) ? v : 0 };
                          setQueryItems(newItems);
                        }}
                        disabled={loading}
                        title={loading ? t('tooltips.weightLocked') : undefined}
                        className="w-20 rounded border border-slate-300 px-2 py-1 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:bg-slate-200"
                      />
                    </label>
                  </div>
                  <button
                    onClick={() => handleRemoveItem(idx)}
                    className="self-start text-lg text-rose-500 transition hover:text-rose-600 sm:self-auto"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-4 flex justify-end">
              <button onClick={handleAnalyze} disabled={loading || !serverReady} className={runAnalysisButtonClass}>
                {!serverReady
                  ? t('buttons.loadingGraph')
                  : loading
                    ? t('buttons.analyzing')
                    : t('buttons.runAnalysis')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-700">
          {t('misc.errorBanner', { message: error })}
        </div>
      )}

      {/* --- 結果 & 調整エリア --- */}
      {results.length > 0 && !loading && (
        <div className="mt-8 rounded-xl bg-white p-6 shadow">
          {/* Stage 2: パラメータ調整 */}
          <div className="rounded-lg bg-indigo-50 p-4">
            <h3 className="text-lg font-semibold text-indigo-900">{t('sections.postProcess')}</h3>
            <div className="mt-3 flex flex-col gap-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-center">
                <span className="font-semibold text-indigo-900">
                  {t('labels.parameter')}: {Number.isFinite(cParam) ? cParam.toFixed(2) : '—'}
                </span>
                <div className="flex flex-1 items-center gap-3">
                  <span className="text-sm text-slate-600">{t('adjust.minor')}</span>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.01"
                    value={cParam}
                    onChange={(e) => handleAdjust(parseFloat(e.target.value))}
                    className="flex-1 accent-indigo-600"
                  />
                  <span className="text-sm text-slate-600">{t('adjust.major')}</span>
                </div>
              </div>

              <p className="text-sm text-slate-600">
                {t.rich('adjust.description1', {
                  b: (chunks) => <b>{chunks}</b>,
                })}
              </p>
              <p className="text-sm text-slate-600">
                {t.rich('adjust.description2', {
                  b: (chunks) => <b>{chunks}</b>,
                })}
              </p>
            </div>
          </div>

          {/* 結果リスト */}
          <div className="mt-6">
            <h3 className="text-xl font-semibold">{t('sections.topMovies')}</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                    <th className="px-3 py-2">{t('table.rank')}</th>
                    <th className="px-3 py-2">{t('table.name')}</th>
                    <th className="px-3 py-2">{t('table.score')}</th>
                    <th className="px-3 py-2 text-center">{t('table.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleResults.map((res: ResultItem, idx: number) => (
                    <tr key={res.id} className="border-b border-slate-100">
                      <td className="px-3 py-3 text-sm font-semibold text-slate-700">{idx + 1}</td>
                      <td className="px-3 py-3">
                        {getDisplayName(res) ? (
                          <div className="flex flex-col items-start">
                            <button
                              onClick={() => handleResultSelection(res)}
                              className="text-left text-base font-semibold text-sky-600 transition hover:text-sky-700"
                            >
                              {getDisplayName(res)}
                            </button>
                            {typeof res.ranking === 'number' ? (
                              <span className="text-xs text-slate-500">#{res.ranking}</span>
                            ) : null}
                          </div>
                        ) : (
                          res.id
                        )}
                      </td>
                      <td className="px-3 py-3 text-base font-semibold text-sky-700">
                        {Number.isFinite(res.score) ? res.score.toFixed(4) : '—'}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <button
                          onClick={() => handleBlacklistAdd(res)}
                          className="text-sm font-semibold text-rose-600 underline-offset-2 transition hover:text-rose-700"
                          title={t('tooltips.exclude')}
                        >
                          {t('buttons.exclude')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {blacklist.length > 0 && (
            <div className="mt-6 rounded-lg border border-rose-100 bg-rose-50 p-4">
              <h4 className="text-base font-semibold text-rose-900">{t('labels.excludedMovies')}</h4>
              <ul className="mt-2 divide-y divide-rose-100 text-sm">
                {blacklist.map((entry: BlacklistEntry) => (
                  <li key={entry.id} className="flex items-center justify-between py-2">
                    <span>{entry.name ?? t('misc.unknownMovie')}</span>
                    <button
                      onClick={() => handleBlacklistRemove(entry.id)}
                      className="text-lg text-rose-500 transition hover:text-rose-600"
                      title={t('tooltips.allow')}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Groq/ChatGPT explain controls */}
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex flex-col text-sm font-semibold text-slate-700">
              {t('labels.aiModel')}
              <select
                value={aiSelection}
                onChange={(e) => setAiSelection(e.target.value)}
                className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm shadow-sm transition focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
              >
                <option value="groq:openai/gpt-oss-20b">Groq · GPT-OSS 20B</option>
                <option value="groq:openai/gpt-oss-120b">Groq · GPT-OSS 120B</option>
                <option value="openai:gpt-5">ChatGPT · GPT-5</option>
                <option value="openai:gpt-5-mini">ChatGPT · GPT-5 mini</option>
                <option value="openai:gpt-5-nano">ChatGPT · GPT-5 nano</option>
              </select>
            </label>
            <button
              onClick={handleGroqExplain}
              disabled={groqLoading}
              className="rounded-lg bg-indigo-500 px-4 py-2 text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {groqLoading ? t('buttons.explaining') : t('buttons.explain')}
            </button>
          </div>

          {/* Analysis Panel (shows response from Groq) */}
          <div className="mt-4">
            <h4 className="text-base font-semibold">{t('labels.aiAnalysis')}</h4>
            {groqError && <div className="mt-2 text-sm text-rose-600">{groqError}</div>}
            <div className="mt-2 min-h-20 rounded-lg bg-indigo-50 p-4 text-sm leading-relaxed text-slate-800">
              {groqOutput ? (
                <ReactMarkdown
                  components={{
                    h3: ({ node, children, ...props }) => {
                      // 現在のセクション色を取得
                      const currentColor = SECTION_THEME_COLORS[sectionColorIndexRef.current % SECTION_THEME_COLORS.length];
                      // 次のセクションのためにインクリメント
                      sectionColorIndexRef.current += 1;
                      return <h3 className={`mt-4 text-base font-semibold ${currentColor.text} first:mt-0`} {...props}>{children}</h3>;
                    },
                    h4: ({ node, ...props }) => <h4 className="mt-3 text-sm font-semibold text-indigo-800 first:mt-0" {...props} />,
                    p: ({ node, children, ...props }) => {
                      // テキストノードをチェック（Score:を含むかどうか）
                      const childrenText = children ? String(children) : '';
                      const hasScore = childrenText.includes('Score:');
                      
                      if (hasScore && sectionColorIndexRef.current > 0) {
                        // スコア行：前のセクション色を使用
                        const scoreColor = SECTION_THEME_COLORS[(sectionColorIndexRef.current - 1) % SECTION_THEME_COLORS.length];
                        return <p className={`mt-2 leading-relaxed first:mt-0 font-medium ${scoreColor.text}`} {...props}>{children}</p>;
                      }
                      
                      return <p className="mt-2 leading-relaxed first:mt-0" {...props}>{children}</p>;
                    },
                    ul: ({ node, ...props }) => (
                        <ul
                        className={'my-2 list-disc space-y-1 pl-6 ' + MARKDOWN_LIST_COLOR_CLASSES}
                        {...props}
                      />
                    ),
                    ol: ({ node, ...props }) => (
                      <ol
                        className={'my-2 list-decimal space-y-1 pl-6 ' + MARKDOWN_LIST_COLOR_CLASSES}
                        {...props}
                      />
                    ),
                    li: ({ node, ...props }) => <li className="leading-relaxed" {...props} />,
                    strong: ({ node, ...props }) => {
                      // 太字（映画タイトル等）：前のセクション色を使用
                      if (sectionColorIndexRef.current > 0) {
                        const titleColor = SECTION_THEME_COLORS[(sectionColorIndexRef.current - 1) % SECTION_THEME_COLORS.length];
                        return <strong className={`font-semibold ${titleColor.text}`} {...props} />;
                      }
                      return <strong className="font-semibold text-slate-900" {...props} />;
                    },
                  }}
                >
                  {groqOutput}
                </ReactMarkdown>
              ) : (
                <p>{t('placeholders.aiPanel')}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
