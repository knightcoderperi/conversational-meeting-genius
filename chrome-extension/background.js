// Background service worker for Omnimeet Extension
let captureStream = null;
let mediaRecorder = null;
let isCapturing = false;
let websocketConnection = null;

// API Configuration - Update with your Supabase URL
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);
  
  switch (message.action) {
    case 'START_CAPTURE':
      startMeetingCapture(message.tabId, sendResponse);
      return true; // Async response
      
    case 'STOP_CAPTURE':
      stopMeetingCapture(sendResponse);
      return true;
      
    case 'GET_STATUS':
      sendResponse({ isCapturing, hasStream: !!captureStream });
      break;
      
    default:
      sendResponse({ error: 'Unknown action' });
  }
});

async function startMeetingCapture(tabId, sendResponse) {
  try {
    console.log('Starting capture for tab:', tabId);
    
    // Capture tab with both audio and video
    const stream = await new Promise((resolve, reject) => {
      chrome.tabCapture.capture({
        audio: true,
        video: true,
        audioConstraints: {
          mandatory: {
            chromeMediaSource: 'tab',
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
          }
        },
        videoConstraints: {
          mandatory: {
            chromeMediaSource: 'tab',
            maxWidth: 1920,
            maxHeight: 1080,
            maxFrameRate: 30
          }
        }
      }, (stream) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (stream) {
          resolve(stream);
        } else {
          reject(new Error('No stream captured'));
        }
      });
    });

    captureStream = stream;
    isCapturing = true;
    
    console.log('Stream captured successfully:', {
      audioTracks: stream.getAudioTracks().length,
      videoTracks: stream.getVideoTracks().length
    });
    
    // Start processing audio chunks
    await startAudioProcessing(stream, tabId);
    
    // Start video frame analysis for speaker identification
    startVideoAnalysis(stream, tabId);
    
    sendResponse({ 
      success: true, 
      message: 'Capture started successfully',
      audioTracks: stream.getAudioTracks().length,
      videoTracks: stream.getVideoTracks().length
    });
    
    // Notify popup of status change
    notifyPopup({ type: 'CAPTURE_STARTED' });
    
  } catch (error) {
    console.error('Failed to start capture:', error);
    sendResponse({ 
      success: false, 
      error: error.message || 'Failed to start capture'
    });
  }
}

async function startAudioProcessing(stream, tabId) {
  try {
    // Create MediaRecorder for audio processing
    const audioStream = new MediaStream(stream.getAudioTracks());
    
    mediaRecorder = new MediaRecorder(audioStream, {
      mimeType: 'audio/webm;codecs=opus',
      audioBitsPerSecond: 128000
    });
    
    mediaRecorder.ondataavailable = async (event) => {
      if (event.data.size > 0 && isCapturing) {
        await processAudioChunk(event.data, tabId);
      }
    };
    
    mediaRecorder.onerror = (error) => {
      console.error('MediaRecorder error:', error);
    };
    
    // Start recording in 2-second chunks for real-time processing
    mediaRecorder.start(2000);
    console.log('Audio processing started');
    
  } catch (error) {
    console.error('Error starting audio processing:', error);
  }
}

async function processAudioChunk(audioBlob, tabId) {
  try {
    // Convert blob to base64 for API transmission
    const arrayBuffer = await audioBlob.arrayBuffer();
    const base64Audio = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
    
    // Send to your Supabase edge function
    const response = await fetch(`${SUPABASE_URL}/functions/v1/enhance-transcription`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        audio: base64Audio,
        meetingId: `tab_${tabId}`,
        enableSpeakerDiarization: true,
        realtime: true
      })
    });
    
    if (!response.ok) {
      throw new Error(`API call failed: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Send transcription to content script and popup
    if (data.segments && data.segments.length > 0) {
      notifyContentScript(tabId, {
        type: 'TRANSCRIPTION_UPDATE',
        data: data
      });
      
      notifyPopup({
        type: 'TRANSCRIPTION_UPDATE',
        data: data
      });
    }
    
  } catch (error) {
    console.error('Error processing audio chunk:', error);
  }
}

function startVideoAnalysis(stream, tabId) {
  const videoTracks = stream.getVideoTracks();
  if (videoTracks.length === 0) return;
  
  // Create video element for frame analysis
  const video = document.createElement('video');
  video.srcObject = new MediaStream(videoTracks);
  video.play();
  
  // Capture frames every 5 seconds for speaker identification
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  const analyzeFrame = async () => {
    if (!isCapturing) return;
    
    try {
      if (video.videoWidth > 0 && video.videoHeight > 0) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0);
        
        // Convert to blob for speaker identification
        canvas.toBlob(async (blob) => {
          if (blob) {
            const arrayBuffer = await blob.arrayBuffer();
            const imageData = Array.from(new Uint8Array(arrayBuffer));
            
            // Send to speaker identification service
            try {
              const response = await fetch(`${SUPABASE_URL}/functions/v1/identify-speaker`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  imageBlob: imageData,
                  meetingId: `tab_${tabId}`
                })
              });
              
              if (response.ok) {
                const data = await response.json();
                if (data.speaker) {
                  notifyPopup({
                    type: 'SPEAKER_IDENTIFIED',
                    speaker: data.speaker
                  });
                }
              }
            } catch (error) {
              console.error('Speaker identification error:', error);
            }
          }
        }, 'image/jpeg', 0.8);
      }
      
      // Schedule next analysis
      if (isCapturing) {
        setTimeout(analyzeFrame, 5000);
      }
    } catch (error) {
      console.error('Video analysis error:', error);
    }
  };
  
  video.addEventListener('loadedmetadata', () => {
    setTimeout(analyzeFrame, 1000);
  });
}

function stopMeetingCapture(sendResponse) {
  try {
    isCapturing = false;
    
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    
    if (captureStream) {
      captureStream.getTracks().forEach(track => track.stop());
      captureStream = null;
    }
    
    if (websocketConnection) {
      websocketConnection.close();
      websocketConnection = null;
    }
    
    console.log('Capture stopped successfully');
    sendResponse({ success: true, message: 'Capture stopped' });
    
    // Notify popup of status change
    notifyPopup({ type: 'CAPTURE_STOPPED' });
    
  } catch (error) {
    console.error('Error stopping capture:', error);
    sendResponse({ success: false, error: error.message });
  }
}

function notifyContentScript(tabId, message) {
  chrome.tabs.sendMessage(tabId, message).catch(error => {
    console.log('Content script not available:', error);
  });
}

function notifyPopup(message) {
  chrome.runtime.sendMessage(message).catch(error => {
    console.log('Popup not available:', error);
  });
}

// Handle tab updates and cleanup
chrome.tabs.onRemoved.addListener((tabId) => {
  if (isCapturing) {
    console.log('Meeting tab closed, stopping capture');
    stopMeetingCapture(() => {});
  }
});

console.log('Omnimeet background service worker loaded');