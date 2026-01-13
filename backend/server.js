const express = require('express');
const cors = require('cors');
const path = require('path');
const { Server } = require('ws'); 
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken'); 
const cookieParser = require('cookie-parser'); 
const fs = require('fs');

dotenv.config({ path: require('path').resolve(__dirname, 'my-config.env') });

const app = express();


const PORT = process.env.PORT || 3000;


app.set("trust proxy", 1); 


const db = require('./db'); 

app.use(express.json({ limit: '10mb' })); 
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use(cookieParser()); 

const { body, validationResult } = require('express-validator');

app.post('/example', 
    body('userInput').trim().escape(), 
    (req, res) => {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ errors: errors.array() });
        }
        const safeInput = req.body.userInput;
        res.json({ message: 'Sanitized input received', safeInput });
    });


app.use(cors({
    origin: 'https://folkout.com',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));

const crypto = require('crypto');


app.post('/api/create-account', async (req, res) => {
    try {

        await deleteInactiveAccounts(); 

        const secretKey = crypto.randomBytes(16).toString('hex');

        
        const [rows] = await db.query(`
            SELECT group_id, COUNT(*) AS user_count 
            FROM users 
            GROUP BY group_id 
            HAVING user_count < 50 
            ORDER BY group_id ASC
        `);

        
        let groupId = rows.length > 0 
            ? rows[0].group_id 
            : (await db.query(`
                SELECT IFNULL(MAX(group_id), 0) + 1 AS new_group_id 
                FROM users
            `))[0][0].new_group_id;

        
        const insertResult = await db.query(`
            INSERT INTO users (icon, group_id, secret_key) 
            VALUES (?, ?, ?)
        `, [null, groupId, secretKey]);
        
        const newUserId = insertResult[0].insertId;      

        
        await db.query(`
            UPDATE users 
            SET nickname = ? 
            WHERE id = ?
        `, [`user${newUserId}`, newUserId]);

        
        res.status(201).json({
            success: true,
            groupId, 
            secretKey,
            nickname: `user${newUserId}`
        });
    } catch (error) {
        console.error('Error creating account:', error.message);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});


const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 5, 
    message: { success: false, message: 'Too many login attempts, please try again later' },
    standardHeaders: true, 
    legacyHeaders: false,  
});


app.post('/api/login', loginLimiter, async (req, res) => {
  const { secretKey } = req.body;

  try {
    await deleteInactiveAccounts(); 

    const [rows] = await db.query(
      'SELECT id, nickname, icon, group_id, last_login, first_login_done FROM users WHERE secret_key = ?',
      [secretKey]
    );
    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: 'Invalid secret key' });
    }

    const user = rows[0];
    const baseCookie = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
    };

    let accessToken;

    if (user.first_login_done === 0) {
      
      await db.query('UPDATE users SET first_login_done = 1 WHERE id = ?', [user.id]);
      accessToken = jwt.sign({ user_id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
      res.cookie('access_token', accessToken, { ...baseCookie, maxAge: 60 * 60 * 1000 });
    } else {
      
      await db.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
      accessToken = jwt.sign({ user_id: user.id }, process.env.JWT_SECRET, { expiresIn: '1y' });
      res.cookie('access_token', accessToken, { ...baseCookie, maxAge: 365 * 24 * 60 * 60 * 1000 });
    }

    
    res.cookie('group_id', user.group_id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Strict',
      maxAge: 365 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      user: { id: user.id, nickname: user.nickname, icon: user.icon, group_id: user.group_id },
    });
  } catch (error) {
    console.error('ログインエラー:', error.message);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

const deleteInactiveAccounts = async () => {
    try {
        
        const [rowsProbation] = await db.query(`
        SELECT id FROM users
        WHERE last_login IS NULL
            AND created_at < NOW() - INTERVAL 7 DAY
        `);
        
        const [rowsDormant] = await db.query(`
        SELECT id FROM users
        WHERE last_login IS NOT NULL
            AND last_login < NOW() - INTERVAL 1 YEAR
        `);
        const rows = [...rowsProbation, ...rowsDormant];

        for (const user of rows) {
            const userId = user.id;

            
            const [userResult] = await db.query('SELECT icon FROM users WHERE id = ?', [userId]);
            const userIconPath = userResult[0]?.icon;

            if (userIconPath && userIconPath.startsWith('/uploads/')) {
                const absolutePath = path.join(__dirname, '..', userIconPath);
                if (fs.existsSync(absolutePath)) {
                    fs.unlinkSync(absolutePath);
                    console.log(`アイコン削除: ${absolutePath}`);
                }
            }

            
            await db.query('DELETE FROM comments WHERE user_id = ?', [userId]);
            await db.query('DELETE FROM posts WHERE user_id = ?', [userId]);
            await db.query('DELETE FROM vote_records WHERE vote_action_id IN (SELECT id FROM vote_actions WHERE target_user_id = ?)', [userId]);
            await db.query('DELETE FROM vote_actions WHERE target_user_id = ?', [userId]);
            await db.query('DELETE FROM representative_votes WHERE candidate_id = ?', [userId]);
            await db.query('DELETE FROM users WHERE id = ?', [userId]);

            console.log(`User ${userId} and all related data deleted.`);
        }

        console.log(`合計 ${rows.length} 件の非アクティブユーザーを削除しました（初回>7日 or 最終ログイン>1年）。`);
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


const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 1000, 
    message: { success: false, message: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api', apiLimiter);


app.use('/api/posts', postsRouter);
app.use('/api/votes', votesRouter);
app.use('/api/users', usersRouter);
app.use('/api/histories', historiesRouter);
app.use('/api/tags', tagsRouter);


app.use('/uploads', express.static(path.resolve(__dirname, 'uploads')));

app.use(express.static(path.join(__dirname, '../build'))); 
app.use(express.static(path.join(__dirname, '../public')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../build', 'index.html'));
});


const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running at http://0.0.0.0:${PORT}`);
});


const wss = new Server({ server });
console.log('WebSocket server is running');

const clients = new Map(); 

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


app.use((err, req, res, next) => {
    console.error('Global error handler:', err.message);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || 'Internal server error',
    });
});