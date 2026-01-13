import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './History.css';

const History = () => {
  const [events, setEvents] = useState([]); 

  const API_URL = process.env.REACT_APP_API_URL;

  useEffect(() => {
    axios
        .get(`${API_URL}/api/histories/vote-actions`, { withCredentials: true }) 
        .then((response) => {
            
            if (Array.isArray(response.data)) {
                setEvents(response.data); 
            } else {
                setEvents([]); 
            }
        })
        .catch((error) => {
            console.error('Error fetching vote actions:', error);
            setEvents([]); 
        });
}, []); 

  return (
    <div className="history-container">
      <h2 className="history-title">履歴</h2>
      <div className="history-timeline">
        {events.length > 0 ? (
          events.map((event, index) => (
            <div key={index} className="history-timeline-event">
              <div className="event-date">
                {new Date(event.deadline).toLocaleDateString('ja-JP', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </div>
              <div className="event-description">
                <div>
                  「{event.action || '不明'}」が{event.yes > event.no ? '可決' : '否決'}されました。
                </div>
                <div>代表者: {event.representative || '不明'}</div>
                <div>対象ユーザー: {event.target_user || '不明'}</div>
                <div>理由: {event.reason || '理由なし'}</div>
                <div>賛成: {event.yes || 0} 反対: {event.no || 0}</div>
              </div>
            </div>
          ))
        ) : (
          <div className="no-history">履歴がありません。</div>
        )}
      </div>
    </div>
  );
};

export default History;
