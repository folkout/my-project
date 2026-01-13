const socket = new WebSocket('ws://163.44.113.241:3000'); 


socket.onopen = () => {
    console.log('WebSocket connected');
};


socket.onmessage = (event) => {
    console.log('Message received:', event.data);
    
};


socket.onerror = (error) => {
    console.error('WebSocket error:', error);
};


socket.onclose = () => {
    console.log('WebSocket connection closed');
};


function sendMessage(message) {
    if (socket.readyState === WebSocket.OPEN) {
        socket.send(message);
    } else {
        console.error('WebSocket is not open');
    }
}


export { sendMessage };
