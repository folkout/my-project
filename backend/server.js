const express = require('express');
const cors = require('cors');
const path = require('path');
const { Server } = require('ws'); // WebSocket用
const passport = require('passport');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken'); // トークン検証用
const cookieParser = require('cookie-parser'); // cookie-parserのインポート
const fs = require('fs');

dotenv.config({ path: './my-config.env' });

const app = express();

// 環境変数 PORT
const PORT = process.env.PORT || 3000;

// `trust proxy` 設定（Nginx経由のリクエスト対応）
app.set("trust proxy", 1); // 1 に設定することで適切に動作

// Passport設定
const db = require('./db'); // データベース接続用モジュールをインポート

app.use(express.json({ limit: '10mb' })); 
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// JSON リクエストを受け取るためのミドルウェア
app.use(express.json());
app.use(cookieParser()); // Cookieパーサーミドルウェアを使用

const { body, validationResult } = require('express-validator');

app.post('/example', 
    body('userInput').trim().escape(), // サニタイズ処理
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const safeInput = req.body.userInput;
        res.json({ message: 'Sanitized input received', safeInput });
    });

// CORS設定（バックエンドをfolkout.comのみに限定）
app.use(cors({
    origin: 'https://folkout.com',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

const crypto = require('crypto');

// 新規アカウント作成
app.post('/api/create-account', async (req, res) => {
    try {

        await deleteInactiveAccounts(); // **古いアカウントを削除**

        const secretKey = crypto.randomBytes(16).toString('hex');

        // 現在の group_id 割り当て状況を取得
        const [rows] = await db.query(`
            SELECT group_id, COUNT(*) AS user_count 
            FROM users 
            GROUP BY group_id 
            HAVING user_count < 50 
            ORDER BY group_id ASC
        `);

        // 利用可能な group_id を割り当て
        let groupId = rows.length > 0 
            ? rows[0].group_id 
            : (await db.query(`
                SELECT IFNULL(MAX(group_id), 0) + 1 AS new_group_id 
                FROM users
            `))[0][0].new_group_id;

        // 新しいユーザーを挿入してidを取得
        const insertResult = await db.query(`
            INSERT INTO users (icon, group_id, secret_key) 
            VALUES (?, ?, ?)
        `, [null, groupId, secretKey]);
        
        const newUserId = insertResult[0].insertId;      

        // `nickname`を更新
        await db.query(`
            UPDATE users 
            SET nickname = ? 
            WHERE id = ?
        `, [`user${newUserId}`, newUserId]);

        // 結果を返す
        res.status(201).json({
            success: true,
            groupId, // group_id を追加
            secretKey,
            nickname: `user${newUserId}`
        });
    } catch (error) {
        console.error('Error creating account:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// ログイン用APIの試行回数制限
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分
    max: 5, // 最大5回まで許可
    message: { success: false, message: 'Too many login attempts, please try again later' },
    standardHeaders: true, // RateLimitヘッダを有効化
    legacyHeaders: false,  // 古いRateLimitヘッダを無効化
});

// **ログインAPI**
app.post('/api/login', async (req, res) => {
    const { secretKey } = req.body;
    try {
        await deleteInactiveAccounts(); // **古いアカウントを削除**

        const [rows] = await db.query(
            'SELECT id, nickname, icon, group_id, last_login FROM users WHERE secret_key = ?',
            [secretKey]
        );

        if (rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid secret key' });
        }

        const user = rows[0];

        if (user.last_login === null) {
            // **初回ログイン時（NULL の場合）、"1年前+7日後" の値をセット**
            await db.query(
                'UPDATE users SET last_login = NOW() - INTERVAL 1 YEAR + INTERVAL 7 DAY WHERE id = ?',
                [user.id]
            );
        } else {
            // **2回目以降のログイン時は通常通り NOW() をセット**
            await db.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
        }

        // **アクセストークンを発行（1年間有効）**
        const accessToken = jwt.sign({ user_id: user.id }, process.env.JWT_SECRET, { expiresIn: '1y' });

        // **トークンをCookieにセット**
        res.cookie('access_token', accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            maxAge: 365 * 24 * 60 * 60 * 1000 // **1年**
        });

        res.cookie('group_id', user.group_id, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            maxAge: 365 * 24 * 60 * 60 * 1000 // **1年**
        });

        res.status(200).json({
            success: true,
            user: {
                id: user.id,
                nickname: user.nickname,
                icon: user.icon,
                group_id: user.group_id,
            },
        });
    } catch (error) {
        console.error('ログインエラー:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

const deleteInactiveAccounts = async () => {
    try {
        // 削除対象ユーザーのIDを取得
        const [rows] = await db.query(`
            SELECT id FROM users 
            WHERE last_login < NOW() - INTERVAL 1 YEAR
               OR (last_login IS NULL AND created_at < NOW() - INTERVAL 1 HOUR)
        `);

        for (const user of rows) {
            const userId = user.id;

            // アイコンファイル削除
            const [userResult] = await db.query('SELECT icon FROM users WHERE id = ?', [userId]);
            const userIconPath = userResult[0]?.icon;

            if (userIconPath && userIconPath.startsWith('/uploads/')) {
                const absolutePath = path.join(__dirname, '..', userIconPath);
                if (fs.existsSync(absolutePath)) {
                    fs.unlinkSync(absolutePath);
                    console.log(`アイコン削除: ${absolutePath}`);
                }
            }

            // 関連データを削除
            await db.query('DELETE FROM comments WHERE user_id = ?', [userId]);
            await db.query('DELETE FROM posts WHERE user_id = ?', [userId]);
            await db.query('DELETE FROM vote_records WHERE vote_action_id IN (SELECT id FROM vote_actions WHERE target_user_id = ?)', [userId]);
            await db.query('DELETE FROM vote_actions WHERE target_user_id = ?', [userId]);
            await db.query('DELETE FROM representative_votes WHERE candidate_id = ?', [userId]);
            await db.query('DELETE FROM users WHERE id = ?', [userId]);

            console.log(`User ${userId} and all related data deleted.`);
        }

        console.log(`合計 ${rows.length} 件の非アクティブユーザーと関連データを削除しました。`);
    } catch (error) {
        console.error('Error deleting inactive accounts:', error.message);
    }
};

module.exports = deleteInactiveAccounts;

const postsRouter = require('./routes/posts');
const votesRouter = require('./routes/votes');
const usersRouter = require('./routes/users');
const historiesRouter = require('./routes/histories');
const tagsRouter = require('./routes/tags');

// APIのRate Limitingを設定
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分
    max: 1000, // 最大リクエスト数
    message: { success: false, message: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api', apiLimiter);

// 認証ミドルウェアを特定のルートに適用
app.use('/api/posts', postsRouter);
app.use('/api/votes', votesRouter);
app.use('/api/users', usersRouter);
app.use('/api/histories', historiesRouter);
app.use('/api/tags', tagsRouter);

// 静的ファイルの提供
app.use('/uploads', express.static(path.resolve(__dirname, 'uploads')));

app.use(express.static(path.join(__dirname, '../build'))); // これを先に
app.use(express.static(path.join(__dirname, '../public')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../build', 'index.html'));
});

// HTTPサーバー作成
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running at http://0.0.0.0:${PORT}`);
});

// WebSocketサーバーのセットアップ
const wss = new Server({ server });
console.log('WebSocket server is running');

const clients = new Map(); // { userId: WebSocket }

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (data.type === 'register') {
                ws.userId = data.userId;
                clients.set(data.userId, ws);
            } else if (data.type === 'message') {
                const { text, sender, receiver } = data;
                const receiverWs = clients.get(receiver);
                if (receiverWs && receiverWs.readyState === ws.OPEN) {
                    receiverWs.send(JSON.stringify({ text, sender }));
                }
            }
        } catch (err) {
            console.error('Error handling WebSocket message:', err.message);
        }
    });

    ws.on('close', () => {
        if (ws.userId) {
            clients.delete(ws.userId);
        }
    });
});

// エラーハンドリング（ミドルウェア）
app.use((err, req, res, next) => {
    console.error('Global error handler:', err.message);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error',
    });
});