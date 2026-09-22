'use client';

import VideoTile from './VideoTile';

export default function VideoGrid({ localStream, localUser, remoteStreams, participants }) {
  const participantEntries = Object.entries(participants || {});
  const totalCount = 1 + participantEntries.length;
  const count = Math.min(totalCount, 6);

  return (
    <div className="video-grid-container">
      <div className="video-grid" data-count={count}>
        {/* Local tile */}
        <VideoTile
          stream={localStream}
          name={localUser?.name || 'You'}
          audioOn={localUser?.audioOn}
          videoOn={localUser?.videoOn}
          isLocal={true}
          isSpeaking={false}
        />

        {/* Remote tiles for every participant in the room */}
        {participantEntries.map(([peerId, participant]) => {
          const stream = remoteStreams?.[peerId] || null;
          return (
            <VideoTile
              key={peerId}
              stream={stream}
              name={participant?.name || 'Participant'}
              audioOn={participant?.audioOn}
              videoOn={participant?.videoOn}
              isLocal={false}
              isSpeaking={false}
            />
          );
        })}
      </div>
    </div>
  );
}
