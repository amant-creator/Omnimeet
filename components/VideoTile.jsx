'use client';

import { useRef, useEffect } from 'react';

export default function VideoTile({ stream, name, audioOn, videoOn, isLocal, isSpeaking }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video && stream) {
      video.srcObject = stream;
      // Handle browser autoplay policy for unmuted remote media
      video.play().catch((err) => {
        console.warn('Autoplay prevented for', name, err);
      });
    }
  }, [stream, videoOn]);

  const initial = (name || '?')[0].toUpperCase();
  const showVideo = !!stream && videoOn !== false;

  return (
    <div className={`video-tile ${isSpeaking ? 'speaking' : ''}`}>
      {/* Video element - keep mounted so remote audio always plays */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={isLocal ? '' : 'remote'}
        style={{
          display: showVideo ? 'block' : 'none',
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />

      {/* Avatar placeholder shown when video is off or stream hasn't arrived */}
      {!showVideo && (
        <div className="video-tile-avatar">
          <div className="avatar-circle">{initial}</div>
          <span className="avatar-name">{name}</span>
        </div>
      )}

      {/* Bottom info bar */}
      <div className="video-tile-info">
        <span className="tile-name">
          {name}
          {isLocal && ' (You)'}
        </span>
        <div className="tile-indicators">
          {audioOn === false && (
            <div className="tile-indicator off" title="Muted">🔇</div>
          )}
          {videoOn === false && (
            <div className="tile-indicator off" title="Camera off">📷</div>
          )}
        </div>
      </div>
    </div>
  );
}
