'use strict';



const configs={
  'rtcConfiguration':{
    'iceServers': [{
      'urls': 'stun:stun3.l.google.com:19302'
    }]
  }
}

var g={
  isChannelReady:false,
  isInitiator:false,
  isStarted:false,
  pc:null
}

var signaling = {
  room:'foo',
  socket:null,
  init: function() {
    var socket=io.connect();
    this.socket=socket;
    socket.on('created', (room) => {
      console.log('Created room ' + room);
      g.isInitiator = true;
    });

    socket.on('full', (room) => {
      console.log('Room ' + room + ' is full');
    });

    socket.on('join',  (room) => {
      console.log('Another peer made a request to join room ' + room);
      console.log('This peer is the initiator of room ' + room + '!');
      g.isChannelReady = true;
    });

    socket.on('joined', (room) => {
      console.log('joined: ' + room);
      g.isChannelReady = true;
    });

    socket.on('log', (array) => {
      console.log.apply(console, array);
    });
    socket.on('message', (message) => {
      console.log('Client received message:', message);
      if (message.type === 'offer') {
        if (!isInitiator && !isStarted) {
          maybeStart();
        }
        g.pc.setRemoteDescription(new RTCSessionDescription(message));
        doAnswer();
      } else if (message.type === 'answer' && isStarted) {
        g.pc.setRemoteDescription(new RTCSessionDescription(message));
      } else if (message.type === 'candidate' && isStarted) {
        var candidate = new RTCIceCandidate({
          sdpMLineIndex: message.label,
          candidate: message.candidate
        });
        g.pc.addIceCandidate(candidate);
      } else if (message === 'bye' && isStarted) {
        handleRemoteHangup();
      }
    });
  },
  join: function() {
    if (this.room !== '') {
      this.socket.emit('create or join', this.room);
      console.log('Attempted to create or join room', this.room);
    }
  },
  sendMessage: function(message) {
    console.log('Client sending message: ', message);
    this.socket.emit('message', message);
  },
  leave() {
    console.log('leave room.');
    this.stop();
    signaling.sendMessage('bye');
  },
  stop() {
    g.isStarted = false;
    g.pc.close();
    g.pc = null;
  }
}


/////////////////////////////////////////////////////////

var peerConnection = {
  createPeerConnection: function () {
    try {
      pc = new RTCPeerConnection(null);
      pc.onicecandidate = this.onIceCandidate;
      g.pc=pc;
      console.log('Created RTCPeerConnnection');
    } catch (e) {
      console.log('Failed to create PeerConnection, exception: ' + e.message);
      alert('Cannot create RTCPeerConnection object.');
      return;
    }
  },
  onIceCandidate: function(event) {
    console.log('icecandidate event: ', event);
    if (event.candidate) {
      signaling.sendMessage({
        type: 'candidate',
        label: event.candidate.sdpMLineIndex,
        id: event.candidate.sdpMid,
        candidate: event.candidate.candidate
      });
    } else {
      console.log('End of candidates.');
    }
  },
  onCreateOfferError: function(event) {
    console.log('createOffer() error: ', event);
  },
  offer: function() {
    console.log('Sending offer to peer');
    g.pc.createOffer(setLocalAndSendMessage, handleCreateOfferError);
  },
  answer: function() {
    console.log('Sending answer to peer.');
    g.pc.createAnswer().then(
      setLocalAndSendMessage,
      onCreateSessionDescriptionError
    );
  },
  setLocalAndSendMessage:function (sessionDescription) {
    pc.setLocalDescription(sessionDescription);
    console.log('setLocalAndSendMessage sending message', sessionDescription);
    signaling.sendMessage(sessionDescription);
  },
  onCreateSessionDescriptionError: function(error) {
    trace('Failed to create session description: ' + error.toString());
  }
}

window.onbeforeunload = () => {
  signaling.sendMessage('bye');
};

signaling.init();
signaling.join();