cmake_minimum_required(VERSION 3.14)
project(GraphSolver)

set(CMAKE_CXX_STANDARD 20)

# --- nlohmann/json の自動ダウンロード設定 ---
include(FetchContent)
FetchContent_Declare(
    json
    GIT_REPOSITORY https://github.com/nlohmann/json.git
    GIT_TAG v3.11.2
)
FetchContent_MakeAvailable(json)
# ------------------------------------------

# 実行バイナリの生成 (出力名: graph_solver)
add_executable(graph_solver cpp/main.cpp)

# ライブラリのリンク
target_link_libraries(graph_solver PRIVATE nlohmann_json::nlohmann_json)
# 追加のソースファイルをターゲットに登録
target_sources(graph_solver PRIVATE
    cpp/Graph.cpp
    cpp/WeightedGraph.cpp
    cpp/Eval.cpp
    cpp/Movie.cpp
    cpp/CorrelationAdjuster.cpp
    cpp/SFMT-src-1.5.1/SFMT.c
)

# SFMT の C ソースを明示的に C として扱う（必要なら）
set_source_files_properties(SFMT-src-1.5.1/SFMT.c PROPERTIES LANGUAGE C)

# コンパイル時定義を追加（-DSFMT_MEXP=19937 相当）
target_compile_definitions(graph_solver PRIVATE SFMT_MEXP=19937)

# インクルードディレクトリの設定
target_include_directories(graph_solver PRIVATE cpp/)
