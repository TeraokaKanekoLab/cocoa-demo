FROM --platform=linux/amd64 node:20-bullseye-slim

# 1. 必要なツールのインストール
# git: CMakeのFetchContentでライブラリを取得するために必要
# cmake, g++, make: ビルド用
# sqlite3: DB操作用
RUN apt-get update && apt-get install -y \
    g++ \
    make \
    cmake \
    git \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 2. 依存関係のインストール (SQLiteドライバ含む)
COPY package*.json ./
RUN npm install
RUN npm install sqlite3 sqlite
RUN npm install openai

# 3. ソースコードコピー
COPY . .

# 4. C++ (CMake) ビルド
RUN cmake -S . -B build \
    && cmake --build build

# 5. Next.js ビルド
RUN npm run build

# 6. アプリ起動
EXPOSE 3000
CMD ["npm", "start"]