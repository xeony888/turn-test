"use client"

import { useEffect, useRef } from "react";

export default function Home() {
  const localRef = useRef<HTMLAudioElement>(null);
  const remoteRef = useRef<HTMLAudioElement>(null);
  const socketRef = useRef<WebSocket>(null);
  const pcRef = useRef<RTCPeerConnection>(null);
  useEffect(() => {
    socketRef.current = new WebSocket("wss://server.blockheadsports.com/signaling?matchId=0000");
    pcRef.current = new RTCPeerConnection({
      iceServers: [{
        urls: "turn:18.216.115.52:3478",
        username: crypto.randomUUID(),        // dummy username
        credential: "test"
      }],
      iceTransportPolicy: "relay" // force TURN relay
    });
    pcRef.current.onicecandidate = ({ candidate }: any) => {
      if (candidate) socketRef.current!.send(JSON.stringify({ candidate }));
    };
    socketRef.current.onmessage = async ({ data }: any) => {
      const raw = data;
      // 2) convert to a string
      let str: string;
      if (raw instanceof Blob) {
        str = await raw.text();                // read Blob as text
      } else {
        str = raw as string;                   // already a string
      }
      const msg = JSON.parse(str);
      if (msg.sdp) {
        await pcRef.current!.setRemoteDescription(msg.sdp);
        if (msg.sdp.type === "offer") {
          const answer = await pcRef.current!.createAnswer();
          await pcRef.current!.setLocalDescription(answer);
          socketRef.current!.send(JSON.stringify({ sdp: pcRef.current!.localDescription }));
        }
      } else if (msg.candidate) {
        await pcRef.current!.addIceCandidate(msg.candidate);
      }
    };


    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      localRef.current!.srcObject = stream;
      stream.getTracks().forEach(track => pcRef.current!.addTrack(track, stream));
    });

    // 3. When remote track arrives, attach it
    pcRef.current.ontrack = ({ streams: [stream] }: any) => {
      remoteRef.current!.srcObject = stream;
    };

    // 4. Kick off the call (only one peer should do this)
    // socketRef.current.onopen = async () => {
    //   const offer = await pcRef.current.createOffer();
    //   await pcRef.current.setLocalDescription(offer);
    //   socketRef.current.send(JSON.stringify({ sdp: pcRef.current.localDescription }));
    // };
    return () => {
      pcRef.current!.close();
      socketRef.current!.close();
    };
  }, [])
  const startCall = async () => {
    const offer = await pcRef.current!.createOffer();
    await pcRef.current!.setLocalDescription(offer);
    socketRef.current!.send(JSON.stringify({ sdp: pcRef.current!.localDescription }));
  }
  return (
    <div>
      <button onClick={startCall}>Start Call</button>
      <audio ref={localRef} autoPlay muted style={{ display: "none" }} />
      <audio ref={remoteRef} autoPlay style={{ display: "none" }} />
    </div>
  );
}
