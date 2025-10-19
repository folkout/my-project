const socket = new WebSocket('ws://163.44.113.241:3000'); // サーバーのWebSocketエンドポイント

// 接続イベント
socket.onopen = () => {
    console.log('WebSocket connected');
};

// メッセージ受信イベント
socket.onmessage = (event) => {
    console.log('Message received:', event.data);
    // 必要に応じて画面に表示する処理を追加
};

// 接続エラーイベント
socket.onerror = (error) => {
    console.error('WebSocket error:', error);
};

// 接続終了イベント
socket.onclose = () => {
    console.log('WebSocket connection closed');
};

// メッセージ送信関数
function sendMessage(message) {
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(message);
    } else {
        console.error('WebSocket is not open');
    }
}

// 必要に応じてエクスポート
export { sendMessage };
