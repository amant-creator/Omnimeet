'use client';

import { useState, useRef, useEffect } from 'react';

export default function ChatPanel({ messages, onSend, onClose, currentUserId }) {
  const [text, setText] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="side-panel">
      <div className="panel-header">
        <span className="panel-title">💬 Chat</span>
        <button className="panel-close" onClick={onClose} id="chat-close-btn">✕</button>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && (
          <p style={{ textAlign: 'center', color: 'var(--clr-text-muted)', fontSize: '0.8rem', marginTop: '2rem' }}>
            No messages yet. Say hello! 👋
          </p>
        )}
        {messages.map((msg) => {
          const isOwn = msg.senderId === currentUserId;
          return (
            <div key={msg.id} className={`chat-message ${isOwn ? 'own' : ''}`}>
              <div className="chat-meta">
                {!isOwn && <span>{msg.senderName}</span>}
                <span>{formatTime(msg.timestamp)}</span>
              </div>
              <div className="chat-bubble">{msg.text}</div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="chat-input-area">
        <textarea
          id="chat-input"
          className="chat-input"
          placeholder="Type a message..."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          style={{ height: '38px' }}
        />
        <button id="chat-send-btn" className="chat-send-btn" onClick={handleSend}>
          ➤
        </button>
      </div>
    </div>
  );
}
