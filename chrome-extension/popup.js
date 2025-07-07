// Popup script for Omnimeet Extension
let isCapturing = false;
let currentTabId = null;
let transcriptionData = [];

// DOM Elements
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const captureInfo = document.getElementById('captureInfo');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const transcriptionContainer = document.getElementById('transcriptionContainer');
const transcriptionPreview = document.getElementById('transcriptionPreview');
const messageContainer = document.getElementById('messageContainer');
const autoScrollToggle = document.getElementById('autoScrollToggle');
const speakerIdToggle = document.getElementById('speakerIdToggle');

// Initialize popup
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Popup loaded');
  
  // Get current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabId = tab.id;
  
  // Check if we're on a supported meeting platform
  checkMeetingPlatform(tab.url);
  
  // Get current status
  updateStatus();
  
  // Set up event listeners
  startBtn.addEventListener('click', startCapture);
  stopBtn.addEventListener('click', stopCapture);
  
  // Toggle listeners
  autoScrollToggle.addEventListener('click', () => toggleSetting('autoScroll'));
  speakerIdToggle.addEventListener('click', () => toggleSetting('speakerId'));
  
  // Listen for messages from background
  chrome.runtime.onMessage.addListener(handleBackgroundMessage);
});

function checkMeetingPlatform(url) {
  const supportedPlatforms = [
    { pattern: 'meet.google.com', name: 'Google Meet' },
    { pattern: 'zoom.us', name: 'Zoom' },
    { pattern: 'teams.microsoft.com', name: 'Microsoft Teams' }
  ];
  
  const platform = supportedPlatforms.find(p => url.includes(p.pattern));
  
  if (platform) {
    captureInfo.textContent = `${platform.name} detected`;
    captureInfo.style.color = '#10b981';
  } else {
    captureInfo.textContent = 'Navigate to a meeting platform to start';
    captureInfo.style.color = '#f59e0b';
    startBtn.disabled = true;
    startBtn.textContent = '⚠️ No meeting detected';
  }
}

async function updateStatus() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'GET_STATUS' });
    
    isCapturing = response.isCapturing;
    
    if (isCapturing) {
      statusDot.className = 'status-dot active pulsing';
      statusText.textContent = 'Capturing all participants';
      startBtn.style.display = 'none';
      stopBtn.style.display = 'block';
      transcriptionContainer.style.display = 'block';
    } else {
      statusDot.className = 'status-dot inactive';
      statusText.textContent = 'Ready to capture';
      startBtn.style.display = 'block';
      stopBtn.style.display = 'none';
      transcriptionContainer.style.display = 'none';
    }
  } catch (error) {
    console.error('Error getting status:', error);
  }
}

async function startCapture() {
  if (!currentTabId) {
    showMessage('error', 'No active tab found');
    return;
  }
  
  startBtn.disabled = true;
  startBtn.textContent = '🔄 Starting...';
  
  try {
    const response = await chrome.runtime.sendMessage({
      action: 'START_CAPTURE',
      tabId: currentTabId
    });
    
    if (response.success) {
      showMessage('success', `Capture started! Audio: ${response.audioTracks}, Video: ${response.videoTracks}`);
      updateStatus();
    } else {
      throw new Error(response.error || 'Failed to start capture');
    }
  } catch (error) {
    console.error('Start capture error:', error);
    showMessage('error', `Failed to start: ${error.message}`);
    startBtn.disabled = false;
    startBtn.textContent = '🎯 Start Capturing Meeting';
  }
}

async function stopCapture() {
  stopBtn.disabled = true;
  stopBtn.textContent = '🔄 Stopping...';
  
  try {
    const response = await chrome.runtime.sendMessage({ action: 'STOP_CAPTURE' });
    
    if (response.success) {
      showMessage('success', 'Capture stopped successfully');
      updateStatus();
      transcriptionData = [];
    } else {
      throw new Error(response.error || 'Failed to stop capture');
    }
  } catch (error) {
    console.error('Stop capture error:', error);
    showMessage('error', `Failed to stop: ${error.message}`);
  } finally {
    stopBtn.disabled = false;
    stopBtn.textContent = '⏹️ Stop Capture';
  }
}

function handleBackgroundMessage(message) {
  console.log('Popup received message:', message);
  
  switch (message.type) {
    case 'CAPTURE_STARTED':
      updateStatus();
      showMessage('success', 'Capture started successfully!');
      break;
      
    case 'CAPTURE_STOPPED':
      updateStatus();
      showMessage('success', 'Capture stopped');
      break;
      
    case 'TRANSCRIPTION_UPDATE':
      updateTranscription(message.data);
      break;
      
    case 'SPEAKER_IDENTIFIED':
      showMessage('success', `Speaker identified: ${message.speaker.name}`);
      break;
      
    default:
      console.log('Unknown message type:', message.type);
  }
}

function updateTranscription(data) {
  if (!data.segments || data.segments.length === 0) return;
  
  // Add new segments to our data
  transcriptionData.push(...data.segments);
  
  // Keep only last 10 segments for preview
  if (transcriptionData.length > 10) {
    transcriptionData = transcriptionData.slice(-10);
  }
  
  // Update preview
  transcriptionPreview.innerHTML = '';
  
  if (transcriptionData.length > 0) {
    transcriptionData.forEach(segment => {
      const segmentDiv = document.createElement('div');
      segmentDiv.style.marginBottom = '8px';
      
      const speakerColors = {
        'Speaker A': '#3b82f6',
        'Speaker B': '#10b981', 
        'Speaker C': '#f59e0b',
        'Speaker D': '#ef4444',
        'Speaker E': '#8b5cf6'
      };
      
      const speakerColor = speakerColors[segment.speaker] || '#6b7280';
      
      segmentDiv.innerHTML = `
        <div style="margin-bottom: 4px;">
          <span class="speaker-tag" style="background: ${speakerColor};">
            ${segment.speaker}
          </span>
          <span style="color: #888; font-size: 10px;">
            ${segment.confidence ? Math.round(segment.confidence * 100) + '%' : '90%'}
          </span>
        </div>
        <div style="color: #fff; font-size: 12px; line-height: 1.4;">
          ${segment.text}
        </div>
      `;
      
      transcriptionPreview.appendChild(segmentDiv);
    });
    
    // Auto-scroll if enabled
    if (autoScrollToggle.classList.contains('active')) {
      transcriptionPreview.scrollTop = transcriptionPreview.scrollHeight;
    }
  }
}

function toggleSetting(setting) {
  const toggle = setting === 'autoScroll' ? autoScrollToggle : speakerIdToggle;
  toggle.classList.toggle('active');
  
  // Store setting in chrome.storage if needed
  const settings = {};
  settings[setting] = toggle.classList.contains('active');
  chrome.storage.local.set(settings);
}

function showMessage(type, text) {
  // Clear existing messages
  messageContainer.innerHTML = '';
  
  const messageDiv = document.createElement('div');
  messageDiv.className = type === 'error' ? 'error-message' : 'success-message';
  messageDiv.textContent = text;
  
  messageContainer.appendChild(messageDiv);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (messageDiv.parentNode) {
      messageDiv.parentNode.removeChild(messageDiv);
    }
  }, 5000);
}

// Handle popup close/reopen
window.addEventListener('beforeunload', () => {
  // Popup is closing, no special handling needed
});

console.log('Popup script loaded');
