const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const DATA_FILE = path.join(__dirname, 'feedback-data.json');


function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}


app.use(cors());
app.use(express.json());


async function loadFeedbackData() {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {

    console.log('No existing data file found, starting with empty data');
    return [];
  }
}

async function saveFeedbackData(data) {
  try {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
    console.log('Data saved to file successfully');
  } catch (error) {
    console.error('Error saving data to file:', error);
    throw error;
  }
}


let feedbackStore = [];


async function initializeData() {
  try {
    feedbackStore = await loadFeedbackData();
    console.log(`Loaded ${feedbackStore.length} feedback entries from file`);
  } catch (error) {
    console.error('Error loading data:', error);
    feedbackStore = [];
  }
}


const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};


app.get('/feedback', (req, res) => {
  try {
    const sortedFeedback = [...feedbackStore].sort((a, b) => b.votes - a.votes);
    res.json({
      success: true,
      data: sortedFeedback,
      count: sortedFeedback.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error retrieving feedback',
      error: error.message
    });
  }
});


app.post('/feedback', async (req, res) => {
  try {
    const { name, email, message } = req.body;


    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, and message are required fields'
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    if (message.trim().length < 5) {
      return res.status(400).json({
        success: false,
        message: 'Feedback message must be at least 5 characters long'
      });
    }


    const newFeedback = {
      id: generateId(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      message: message.trim(),
      votes: 0,
      createdAt: new Date().toISOString()
    };


    feedbackStore.push(newFeedback);
    await saveFeedbackData(feedbackStore);

    res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully',
      data: newFeedback
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating feedback',
      error: error.message
    });
  }
});


app.put('/feedback/:id/vote', async (req, res) => {
  try {
    const { id } = req.params;
    const { action } = req.body;

    if (!action || !['upvote', 'downvote'].includes(action)) {
      return res.status(400).json({
        success: false,
        message: 'Action must be either "upvote" or "downvote"'
      });
    }

    const feedback = feedbackStore.find(item => item.id === id);
    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found'
      });
    }

    if (action === 'upvote') {
      feedback.votes += 1;
    } else {
      feedback.votes -= 1;
    }

    await saveFeedbackData(feedbackStore);

    res.json({
      success: true,
      message: `Feedback ${action}d successfully`,
      data: feedback
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating vote',
      error: error.message
    });
  }
});

app.delete('/feedback/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const feedbackIndex = feedbackStore.findIndex(item => item.id === id);
    if (feedbackIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found'
      });
    }

    const deletedFeedback = feedbackStore.splice(feedbackIndex, 1)[0];
    
    await saveFeedbackData(feedbackStore);

    res.json({
      success: true,
      message: 'Feedback deleted successfully',
      data: deletedFeedback
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error deleting feedback',
      error: error.message
    });
  }
});

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    dataFile: DATA_FILE,
    feedbackCount: feedbackStore.length
  });
});

app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

app.use((error, req, res, next) => {
  console.error('Server Error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

async function startServer() {
  await initializeData(); 
  
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📝 Feedback API: http://localhost:${PORT}/feedback`);
    console.log(`💾 Data file: ${DATA_FILE}`);
    console.log(`📋 Loaded ${feedbackStore.length} existing feedback entries`);
  });
}

startServer().catch(console.error);

module.exports = app;