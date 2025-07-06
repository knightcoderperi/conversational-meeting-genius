// Content script for meeting platforms
console.log('Omnimeet content script loaded on:', window.location.href);

let omnimeetUI = null;
let transcriptionContainer = null;

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received:', message);
  
  switch (message.type) {
    case 'TRANSCRIPTION_UPDATE':
      updateTranscriptionUI(message.data);
      break;
      
    case 'SPEAKER_IDENTIFIED':
      showSpeakerNotification(message.speaker);
      break;
      
    default:
      console.log('Unknown message type:', message.type);
  }
  
  sendResponse({ received: true });
});

// Initialize UI when page loads
function initializeOmnimeetUI() {
  if (omnimeetUI) return; // Already initialized
  
  // Create floating transcription panel
  omnimeetUI = document.createElement('div');
  omnimeetUI.id = 'omnimeet-panel';
  omnimeetUI.innerHTML = `
    <div id="omnimeet-container" style="
      position: fixed;
      top: 20px;
      right: 20px;
      width: 350px;
      max-height: 400px;
      background: rgba(0, 0, 0, 0.9);
      border: 1px solid #333;
      border-radius: 8px;
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      display: none;
    ">
      <div style="
        padding: 12px 16px;
        background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
        color: white;
        font-weight: 600;
        border-radius: 8px 8px 0 0;
        display: flex;
        justify-content: space-between;
        align-items: center;
      ">
        <span>🎤 Omnimeet Live</span>
        <button id="omnimeet-close" style="
          background: none;
          border: none;
          color: white;
          cursor: pointer;
          font-size: 18px;
          padding: 0;
          width: 24px;
          height: 24px;
        ">×</button>
      </div>
      
      <div id="omnimeet-status" style="
        padding: 8px 16px;
        background: #1a1a1a;
        color: #4ade80;
        font-size: 12px;
        border-bottom: 1px solid #333;
      ">
        🟢 Capturing all participants
      </div>
      
      <div id="omnimeet-transcription" style="
        padding: 16px;
        max-height: 280px;
        overflow-y: auto;
        color: white;
        font-size: 14px;
        line-height: 1.5;
      ">
        <div style="color: #888; text-align: center; padding: 20px;">
          Waiting for speech...
        </div>
      </div>
      
      <div id="omnimeet-speakers" style="
        padding: 8px 16px;
        background: #1a1a1a;
        border-top: 1px solid #333;
        border-radius: 0 0 8px 8px;
      ">
        <div style="color: #888; font-size: 11px;">
          Active Speakers: <span id="speaker-list">None</span>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(omnimeetUI);
  transcriptionContainer = document.getElementById('omnimeet-transcription');
  
  // Close button functionality
  document.getElementById('omnimeet-close').addEventListener('click', () => {
    omnimeetUI.style.display = 'none';
  });
  
  console.log('Omnimeet UI initialized');
}

function updateTranscriptionUI(data) {
  if (!omnimeetUI) {
    initializeOmnimeetUI();
  }
  
  // Show the panel
  document.getElementById('omnimeet-container').style.display = 'block';
  
  if (data.segments && data.segments.length > 0) {
    // Clear waiting message
    if (transcriptionContainer.innerHTML.includes('Waiting for speech')) {
      transcriptionContainer.innerHTML = '';
    }
    
    // Add new segments
    data.segments.forEach(segment => {
      const segmentDiv = document.createElement('div');
      segmentDiv.style.marginBottom = '12px';
      
      const speakerColors = {
        'Speaker A': '#3b82f6',
        'Speaker B': '#10b981', 
        'Speaker C': '#f59e0b',
        'Speaker D': '#ef4444',
        'Speaker E': '#8b5cf6'
      };
      
      const speakerColor = speakerColors[segment.speaker] || '#6b7280';
      
      segmentDiv.innerHTML = `
        <div style="
          display: flex;
          align-items: center;
          margin-bottom: 4px;
        ">
          <span style="
            background: ${speakerColor};
            color: white;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 600;
            margin-right: 8px;
          ">${segment.speaker}</span>
          <span style="
            color: #888;
            font-size: 10px;
          ">${new Date().toLocaleTimeString()} • ${Math.round((segment.confidence || 0.9) * 100)}%</span>
        </div>
        <div style="color: #fff; margin-left: 4px;">
          ${segment.text}
        </div>
      `;
      
      transcriptionContainer.appendChild(segmentDiv);
    });
    
    // Auto-scroll to bottom
    transcriptionContainer.scrollTop = transcriptionContainer.scrollHeight;
    
    // Update speaker list
    const speakers = [...new Set(data.segments.map(s => s.speaker))];
    document.getElementById('speaker-list').textContent = speakers.join(', ');
  }
}

function showSpeakerNotification(speaker) {
  if (!omnimeetUI) return;
  
  // Create temporary notification
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    background: #10b981;
    color: white;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 12px;
    z-index: 10001;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.2);
  `;
  notification.textContent = `✓ Speaker identified: ${speaker.name}`;
  
  document.body.appendChild(notification);
  
  // Remove after 3 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.parentNode.removeChild(notification);
    }
  }, 3000);
}

// Auto-detect meeting platforms and show capture hint
function detectMeetingPlatform() {
  const url = window.location.href;
  let platform = '';
  
  if (url.includes('meet.google.com')) {
    platform = 'Google Meet';
  } else if (url.includes('zoom.us')) {
    platform = 'Zoom';
  } else if (url.includes('teams.microsoft.com')) {
    platform = 'Microsoft Teams';
  }
  
  if (platform) {
    console.log(`Omnimeet detected ${platform} meeting`);
    showCaptureHint(platform);
  }
}

function showCaptureHint(platform) {
  // Only show if not already capturing
  chrome.runtime.sendMessage({ action: 'GET_STATUS' }, (response) => {
    if (!response.isCapturing) {
      const hint = document.createElement('div');
      hint.id = 'omnimeet-hint';
      hint.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        z-index: 10000;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        cursor: pointer;
        animation: slideDown 0.3s ease-out;
      `;
      
      hint.innerHTML = `
        🎤 Click the Omnimeet extension to start capturing all participants
        <span style="margin-left: 8px; opacity: 0.8;">(${platform} detected)</span>
      `;
      
      document.body.appendChild(hint);
      
      // Remove hint after 5 seconds or on click
      const removeHint = () => {
        if (hint.parentNode) {
          hint.style.animation = 'slideUp 0.3s ease-out';
          setTimeout(() => {
            if (hint.parentNode) {
              hint.parentNode.removeChild(hint);
            }
          }, 300);
        }
      };
      
      hint.addEventListener('click', removeHint);
      setTimeout(removeHint, 5000);
    }
  });
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideDown {
    from { transform: translateX(-50%) translateY(-20px); opacity: 0; }
    to { transform: translateX(-50%) translateY(0); opacity: 1; }
  }
  
  @keyframes slideUp {
    from { transform: translateX(-50%) translateY(0); opacity: 1; }
    to { transform: translateX(-50%) translateY(-20px); opacity: 0; }
  }
`;
document.head.appendChild(style);

// Initialize when page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', detectMeetingPlatform);
} else {
  detectMeetingPlatform();
}

console.log('Omnimeet content script ready');