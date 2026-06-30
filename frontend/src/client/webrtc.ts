/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface PeerConnectionConfig {
  iceServers: RTCIceServer[];
}

export type WebRTCCallback = (event: string, payload: any) => void;

export class SferiumWebRTCMesh {
  private peers: Record<string, RTCPeerConnection> = {};
  private localStream: MediaStream | null = null;
  private onEvent: WebRTCCallback;
  private roomId: string;
  private localUserId: string;
  private config: PeerConnectionConfig;

  constructor(
    roomId: string,
    localUserId: string,
    onEvent: WebRTCCallback,
    config: PeerConnectionConfig = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" }
      ]
    }
  ) {
    this.roomId = roomId;
    this.localUserId = localUserId;
    this.onEvent = onEvent;
    this.config = config;
  }

  public setLocalStream(stream: MediaStream): void {
    this.localStream = stream;
    // Update tracks for existing connections
    Object.keys(this.peers).forEach((targetId) => {
      const pc = this.peers[targetId];
      // Remove old tracks first
      const senders = pc.getSenders();
      senders.forEach((sender) => pc.removeTrack(sender));
      // Add new tracks
      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
      });
    });
  }

  public getLocalStream(): MediaStream | null {
    return this.localStream;
  }

  /**
   * Initializes a fresh connection to a newly joined participant.
   */
  public async createPeerConnection(targetUserId: string, isInitiator: boolean): Promise<RTCPeerConnection> {
    if (this.peers[targetUserId]) {
      console.log(`🔌 WebRTC Connection to peer ${targetUserId} already exists. Returning.`);
      return this.peers[targetUserId];
    }

    const pc = new RTCPeerConnection(this.config);
    this.peers[targetUserId] = pc;

    // Attach local stream tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // Ice Gathering Handlers
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.onEvent("signal", {
          type: "candidate",
          roomId: this.roomId,
          senderId: this.localUserId,
          targetId: targetUserId,
          candidate: event.candidate
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`📡 Ice connection state for ${targetUserId}: ${pc.iceConnectionState}`);
      this.onEvent("state_change", {
        targetUserId,
        state: pc.iceConnectionState
      });
      if (pc.iceConnectionState === "failed" || pc.iceConnectionState === "disconnected") {
        this.handleIceFailure(targetUserId);
      }
    };

    pc.ontrack = (event) => {
      console.log(`🎵 Received WebRTC voice stream track from peer ${targetUserId}`);
      this.onEvent("track", {
        targetUserId,
        stream: event.streams[0],
        track: event.track
      });
    };

    if (isInitiator) {
      try {
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
        await pc.setLocalDescription(offer);
        this.onEvent("signal", {
          type: "offer",
          roomId: this.roomId,
          senderId: this.localUserId,
          targetId: targetUserId,
          sdp: offer.sdp
        });
      } catch (err) {
        console.error(`❌ Failed creating offer description for ${targetUserId}:`, err);
      }
    }

    return pc;
  }

  public async handleSignal(signal: any): Promise<void> {
    const { senderId, type, sdp, candidate } = signal;

    if (type === "offer") {
      const pc = await this.createPeerConnection(senderId, false);
      await pc.setRemoteDescription(new RTCSessionDescription({ type: "offer", sdp }));
      
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      this.onEvent("signal", {
        type: "answer",
        roomId: this.roomId,
        senderId: this.localUserId,
        targetId: senderId,
        sdp: answer.sdp
      });
    } else if (type === "answer") {
      const pc = this.peers[senderId];
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription({ type: "answer", sdp }));
      }
    } else if (type === "candidate") {
      const pc = this.peers[senderId];
      if (pc && candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    }
  }

  private handleIceFailure(targetUserId: string): void {
    console.warn(`⚡ Connection failed to ${targetUserId}. Triggering ICE Restart...`);
    const pc = this.peers[targetUserId];
    if (pc) {
      // ICE restart
      pc.createOffer({ iceRestart: true })
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          this.onEvent("signal", {
            type: "offer",
            roomId: this.roomId,
            senderId: this.localUserId,
            targetId: targetUserId,
            sdp: pc.localDescription?.sdp
          });
        })
        .catch((e) => console.error("ICE Restart offer creation failed:", e));
    }
  }

  public disconnectPeer(targetUserId: string): void {
    const pc = this.peers[targetUserId];
    if (pc) {
      pc.close();
      delete this.peers[targetUserId];
      this.onEvent("peer_disconnected", { targetUserId });
      console.log(`🔌 WebRTC peer ${targetUserId} closed and cleared successfully.`);
    }
  }

  public clear(): void {
    Object.keys(this.peers).forEach((id) => this.disconnectPeer(id));
    if (this.localStream) {
      this.localStream.getTracks().forEach((t) => t.stop());
      this.localStream = null;
    }
    console.log("🧹 WebRTC mesh connection stack fully recycled.");
  }
}
export default SferiumWebRTCMesh;
