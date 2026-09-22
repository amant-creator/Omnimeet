'use client';

export default function ControlBar({
  audioOn,
  videoOn,
  screenSharing,
  chatOpen,
  participantsOpen,
  onToggleAudio,
  onToggleVideo,
  onToggleScreen,
  onToggleChat,
  onToggleParticipants,
  onLeave,
  participantCount,
}) {
  return (
    <div className="control-bar" role="toolbar" aria-label="Meeting controls">
      {/* Left — participant count */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--clr-text-secondary)', fontSize: '0.85rem' }}>
        <span aria-hidden="true">👥</span>
        <span aria-label={`${participantCount} participant${participantCount !== 1 ? 's' : ''}`}>{participantCount}</span>
      </div>

      {/* Center — core controls */}
      <div className="control-center">
        {/* Mic */}
        <button
          id="ctrl-audio"
          className={`ctrl-btn ${!audioOn ? 'muted' : ''}`}
          onClick={onToggleAudio}
          aria-label={audioOn ? 'Mute microphone' : 'Unmute microphone'}
          aria-pressed={!audioOn}
          title={audioOn ? 'Mute' : 'Unmute'}
        >
          <span aria-hidden="true">{audioOn ? '🎤' : '🔇'}</span>
          <span className="ctrl-tooltip">{audioOn ? 'Mute' : 'Unmute'}</span>
        </button>

        {/* Camera */}
        <button
          id="ctrl-video"
          className={`ctrl-btn ${!videoOn ? 'muted' : ''}`}
          onClick={onToggleVideo}
          aria-label={videoOn ? 'Turn off camera' : 'Turn on camera'}
          aria-pressed={!videoOn}
          title={videoOn ? 'Turn off camera' : 'Turn on camera'}
        >
          <span aria-hidden="true">{videoOn ? '📷' : '🚫'}</span>
          <span className="ctrl-tooltip">{videoOn ? 'Camera off' : 'Camera on'}</span>
        </button>

        {/* Screen share */}
        <button
          id="ctrl-screen"
          className={`ctrl-btn ${screenSharing ? 'screen-active' : ''}`}
          onClick={onToggleScreen}
          aria-label={screenSharing ? 'Stop screen sharing' : 'Share your screen'}
          aria-pressed={screenSharing}
        >
          <span aria-hidden="true">🖥️</span>
          <span className="ctrl-tooltip">{screenSharing ? 'Stop sharing' : 'Share screen'}</span>
        </button>

        {/* Leave */}
        <button
          id="ctrl-leave"
          className="ctrl-btn danger"
          onClick={onLeave}
          aria-label="Leave meeting"
        >
          <span aria-hidden="true">📵</span>
          <span className="ctrl-tooltip">Leave meeting</span>
        </button>
      </div>

      {/* Right — panel toggles */}
      <div className="control-right">
        <button
          id="ctrl-chat"
          className={`ctrl-btn ${chatOpen ? 'active' : ''}`}
          onClick={onToggleChat}
          aria-label={chatOpen ? 'Close chat panel' : 'Open chat panel'}
          aria-pressed={chatOpen}
        >
          <span aria-hidden="true">💬</span>
          <span className="ctrl-tooltip">Chat</span>
        </button>

        <button
          id="ctrl-participants"
          className={`ctrl-btn ${participantsOpen ? 'active' : ''}`}
          onClick={onToggleParticipants}
          aria-label={participantsOpen ? 'Close participants panel' : 'Open participants panel'}
          aria-pressed={participantsOpen}
        >
          <span aria-hidden="true">👥</span>
          <span className="ctrl-tooltip">Participants</span>
        </button>
      </div>
    </div>
  );
}
