# Roommate Manager

A web-based roommate task management system that helps roommates assign tasks, track completion, and verify tasks using image recognition.

## Features

- **Task Management**: Create tasks with deadlines and assign them to roommates
- **Image Verification**: Capture photos to verify task completion using Google Vision API
- **Automatic Notifications**: Get notified when tasks are overdue or due
- **Performance Tracking**: View statistics for each roommate including completion rates
- **Task Filtering**: Filter tasks by status (all, pending, completed, overdue)
- **Dashboard**: Overview of pending tasks, completed tasks today, and overdue items

## Setup

1. **Open the Application**
   - Simply open `index.html` in a web browser
   - No build process or server required (works locally)

2. **Set Up Google Vision API Key**
   - Get a Google Cloud Vision API key from [Google Cloud Console](https://console.cloud.google.com/)
   - Open `script.js`
   - Find the line: `const GOOGLE_VISION_API_KEY = 'YOUR_GOOGLE_VISION_API_KEY_HERE';`
   - Replace `'YOUR_GOOGLE_VISION_API_KEY_HERE'` with your actual API key

3. **Enable Google Vision API**
   - In Google Cloud Console, enable the "Cloud Vision API" for your project
   - Make sure billing is enabled (Google provides free tier credits)

## Usage

### Adding Roommates
The app comes with 3 default roommates (Alex, Jordan, Sam). You can modify the `members` array in `script.js` to add or change roommates.

### Creating Tasks
1. Navigate to "Add Task" page
2. Fill in:
   - Task title
   - Description (optional)
   - Assign to (select roommate)
   - Assigned by (select roommate)
   - Deadline (date and time)
3. Click "Create Task"

### Verifying Tasks
1. When a task deadline arrives or is overdue, click "Verify Completion" on the task
2. Click "Start Camera" to access your device camera
3. Take a photo of the completed task
4. Click "Verify Task" to analyze the image
5. If verification passes, the task is marked as completed
6. If verification fails, you'll be prompted to try again

### Viewing Statistics
- **Dashboard**: Overview of task statistics and upcoming tasks
- **All Tasks**: Complete list of all tasks with filtering options
- **Members**: Performance statistics for each roommate including:
  - Total tasks assigned
  - Completed tasks
  - Pending tasks
  - Overdue tasks
  - Completion rate percentage

## Notifications

The app automatically shows notifications for:
- Overdue tasks (every 5 minutes)
- Tasks that have just reached their deadline

Click on overdue notifications to quickly verify the task.

## Data Storage

All data is stored locally in your browser using LocalStorage. This means:
- Data persists between sessions
- Data is specific to your browser
- No server or database required

## Customization

### Google Vision API Verification Logic
The current verification logic in `verifyImageWithGoogleVision()` is a basic implementation. You can customize it in `script.js` to:
- Check for specific objects in images
- Analyze text in images
- Use more sophisticated image analysis based on task types

### Styling
Modify `styles.css` to customize colors, fonts, and layout. The app uses CSS variables for easy theming.

## Browser Compatibility

- Modern browsers with camera access support
- Chrome, Firefox, Safari, Edge (latest versions)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Notes

- Camera access requires HTTPS in production (works on localhost for development)
- The Google Vision API has usage limits and costs (check Google Cloud pricing)
- Without an API key, the app uses simulated verification for demo purposes

## Future Enhancements

Potential improvements:
- User authentication
- Cloud storage for data sync
- Email/SMS notifications
- Task categories and priorities
- Recurring tasks
- Task history and analytics
