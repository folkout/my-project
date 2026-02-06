# my-project（人数制限SNS）

少人数のみが参加できるクローズドなSNSを想定したWebアプリケーションです。  
「人が増えすぎないコミュニティ」を前提にした設計・機能検討を目的として個人開発しました。

<img width="1322" height="834" alt="image" src="https://github.com/user-attachments/assets/944b342e-f984-4dee-bac5-8a13934cb05e" />

## 概要
既存SNSでは、人数増加に伴いコミュニケーションの質が低下する課題があると感じていました。  
本プロジェクトでは「参加人数を制限する」ことを前提に、小規模コミュニティ向けSNSの設計・実装を試みています。

※ 企画背景や思想面の詳細は以下の記事にまとめています  
- https://note.com/folkout/n/nfc1e1e9173da

## 主な機能
- ユーザー登録 / ログイン
- 投稿の作成・閲覧
- ライブラリ管理
- 人数制限を前提としたユーザー管理（代表者、追放者投票）
<img width="1200" height="726" alt="image" src="https://github.com/user-attachments/assets/e37fa1ef-f253-4aac-a180-b94515b67c2d" />
<img width="1200" height="723" alt="image" src="https://github.com/user-attachments/assets/45407e1f-7f60-45d6-bae3-7164764b9956" />
<img width="1200" height="730" alt="image" src="https://github.com/user-attachments/assets/80811a23-1c0f-43f4-b9a4-0ed664ed63fd" />

## 使用技術
- フロントエンド: React
- バックエンド: Node.js
- データベース: MySQL

## デモ（公開サイト）
https://www.folkout.com  
実際に動作している公開サイトです。主要機能をブラウザで確認できます。

## ローカル動作について
本リポジトリはフロントエンドのみを含んでいます。

ユーザー登録や投稿などの処理は、別途用意したバックエンドAPIに通信することで動作します。
そのため、APIの接続先URLを環境変数として指定する必要があります。
- `REACT_APP_API_URL` : 通信先となるバックエンドAPIのURL

※ バックエンドAPIおよびデータベースは本番環境のみに存在するため、このリポジトリ単体ではすべての機能をローカルで再現することはできません。

## ローカルでの確認
```bash
git clone https://github.com/folkout/my-project.git
cd my-project
npm install
npm run build
npm install -g serve
serve -s build
