'use client';

export default function ParticipantPanel({ participants, localUser, isHost, onMute, onKick, onClose }) {
  const allParticipants = [
    { ...localUser, isLocal: true },
    ...Object.values(participants),
  ];

  return (
    <div className="side-panel">
      <div className="panel-header">
        <span className="panel-title">👥 Participants ({allParticipants.length})</span>
        <button className="panel-close" onClick={onClose} id="participants-close-btn">✕</button>
      </div>

      <div className="participant-list">
        {allParticipants.map((p, idx) => (
          <div key={p.id ? `p-${p.id}` : `local-${idx}`} className="participant-item">
            <div className="participant-avatar">
              {(p.name || '?')[0].toUpperCase()}
            </div>

            <div className="participant-info">
              <div className="participant-name">
                {p.name}
                {p.isLocal && ' (You)'}
              </div>
              {p.isHost && <div className="participant-role">Host</div>}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {/* Status indicators */}
              <div className="participant-indicators">
                <span className={`status-dot ${p.audioOn === false ? 'off' : ''}`} title="Mic">
                  {p.audioOn === false ? '🔇' : '🎤'}
                </span>
                <span className={`status-dot ${p.videoOn === false ? 'off' : ''}`} title="Camera">
                  {p.videoOn === false ? '📷' : '📹'}
                </span>
              </div>

              {/* Host controls — only show for others */}
              {isHost && !p.isLocal && (
                <div className="participant-controls">
                  <button
                    className="participant-icon-btn"
                    title="Mute participant"
                    onClick={() => onMute(p.id)}
                    style={{ fontSize: '0.7rem' }}
                  >
                    🔇
                  </button>
                  <button
                    className="participant-icon-btn"
                    title="Remove participant"
                    onClick={() => onKick(p.id)}
                    style={{ fontSize: '0.7rem' }}
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
