'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import Peer from 'simple-peer';

export function useWebRTC({ socket, roomId, localStream }) {
  const peersRef = useRef({}); // socketId -> Peer instance
  const [remoteStreams, setRemoteStreams] = useState({}); // socketId -> MediaStream
  const localStreamRef = useRef(localStream);
  const candidateQueue = useRef({}); // socketId -> Array of queued ICE candidates

  // Keep localStreamRef synchronized
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  const addStream = useCallback((id, stream) => {
    console.log(`[WebRTC] Received remote stream from ${id}`);
    setRemoteStreams((prev) => ({ ...prev, [id]: stream }));
  }, []);

  const removeStream = useCallback((id) => {
    console.log(`[WebRTC] Removing stream and peer for ${id}`);
    setRemoteStreams((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    if (peersRef.current[id]) {
      try {
        peersRef.current[id].destroy();
      } catch {}
      delete peersRef.current[id];
    }
    delete candidateQueue.current[id];
  }, []);

  const createPeer = useCallback(
    (targetId, initiator) => {
      // If peer already exists, do not recreate unless explicitly recreating
      if (peersRef.current[targetId]) {
        return peersRef.current[targetId];
      }

      console.log(`[WebRTC] Creating peer for ${targetId} (initiator: ${initiator})`);

      const streamToSend = localStreamRef.current && typeof localStreamRef.current === 'object'
        ? localStreamRef.current
        : undefined;

      const peer = new Peer({
        initiator,
        trickle: true,
        stream: streamToSend,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
          ],
        },
      });

      peer.on('signal', (data) => {
        if (data.type === 'offer') {
          socket?.emit('offer', { to: targetId, offer: data });
        } else if (data.type === 'answer') {
          socket?.emit('answer', { to: targetId, answer: data });
        } else {
          socket?.emit('ice-candidate', { to: targetId, candidate: data });
        }
      });

      peer.on('stream', (stream) => {
        addStream(targetId, stream);
      });

      peer.on('error', (err) => {
        const msg = err?.message || '';
        if (
          msg.includes('Close called') ||
          msg.includes('User-Initiated Abort') ||
          err?.code === 'ERR_DATA_CHANNEL'
        ) {
          return;
        }
        console.warn(`[WebRTC] Peer warning for ${targetId}:`, err);
        removeStream(targetId);
      });

      peer.on('close', () => {
        removeStream(targetId);
      });

      peersRef.current[targetId] = peer;

      // Drain any queued ICE candidates that arrived before peer creation
      if (candidateQueue.current[targetId]?.length) {
        candidateQueue.current[targetId].forEach((cand) => {
          try {
            peer.signal(cand);
          } catch {}
        });
        delete candidateQueue.current[targetId];
      }

      return peer;
    },
    [socket, addStream, removeStream]
  );

  // Handle incoming signaling events
  useEffect(() => {
    if (!socket) return;

    const handleOffer = ({ from, offer }) => {
      let peer = peersRef.current[from];
      if (!peer) {
        peer = createPeer(from, false);
      }
      try {
        peer.signal(offer);
      } catch (err) {
        console.warn('Signal offer error:', err);
      }
    };

    const handleAnswer = ({ from, answer }) => {
      const peer = peersRef.current[from];
      if (peer) {
        try {
          peer.signal(answer);
        } catch (err) {
          console.warn('Signal answer error:', err);
        }
      }
    };

    const handleIceCandidate = ({ from, candidate }) => {
      const peer = peersRef.current[from];
      if (peer) {
        try {
          peer.signal(candidate);
        } catch (err) {
          console.warn('Signal ICE candidate error:', err);
        }
      } else {
        if (!candidateQueue.current[from]) candidateQueue.current[from] = [];
        candidateQueue.current[from].push(candidate);
      }
    };

    const handleUserLeft = ({ id }) => {
      removeStream(id);
    };

    socket.on('offer', handleOffer);
    socket.on('answer', handleAnswer);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('user-left', handleUserLeft);

    return () => {
      socket.off('offer', handleOffer);
      socket.off('answer', handleAnswer);
      socket.off('ice-candidate', handleIceCandidate);
      socket.off('user-left', handleUserLeft);
    };
  }, [socket, createPeer, removeStream]);

  // Update tracks on all peers when stream changes
  useEffect(() => {
    if (!localStream || typeof localStream !== 'object') return;
    Object.values(peersRef.current).forEach((peer) => {
      if (peer && !peer.destroyed) {
        try {
          if (peer.streams && peer.streams.length > 0) {
            const senders = peer._pc?.getSenders() || [];
            localStream.getTracks().forEach((track) => {
              const sender = senders.find((s) => s.track?.kind === track.kind);
              if (sender) sender.replaceTrack(track).catch(() => {});
            });
          } else {
            peer.addStream(localStream);
          }
        } catch (err) {
          console.warn('Update peer stream error:', err);
        }
      }
    });
  }, [localStream]);

  const destroyAll = useCallback(() => {
    Object.values(peersRef.current).forEach((p) => {
      try {
        p?.destroy();
      } catch {}
    });
    peersRef.current = {};
    candidateQueue.current = {};
    setRemoteStreams({});
  }, []);

  return { remoteStreams, createPeer, destroyAll };
}
