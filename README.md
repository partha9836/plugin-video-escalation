# Twilio Flex Video Escalation Plugin

Enable agents to escalate a Flex conversation (WhatsApp / Chat / SMS) into a secure Twilio Video session with one click.

When an agent clicks the **Video button**:

1. A Twilio Video room is created (scoped to the Task SID)
2. Secure access tokens are generated
3. The customer receives a video link in the conversation
4. The agent automatically joins the video room in a new window

---

## Architecture Overview

```
Agent clicks Video button
        ↓
Flex Plugin calls Twilio Function (/get-tokens.js)
        ↓
Function generates Video tokens (Agent + Customer)
        ↓
Customer receives video link in chat
        ↓
Both join same Twilio Video Room
```

---

# Project Structure

```
/functions
   └── get-tokens.js

/assets
   └── video-room.html

/src
   └── VideoEscalationPlugin.js
```

---

# Twilio Function – `get-tokens.js`

This serverless function:

- Generates Twilio Video Access Tokens
- Creates a room per Task SID
- Returns agent and customer tokens
- Handles CORS properly

```javascript
exports.handler = async function (context, event, callback) {
  const response = new Twilio.Response();
  response.appendHeader("Access-Control-Allow-Origin", "*");
  response.appendHeader("Access-Control-Allow-Methods", "OPTIONS, POST");
  response.appendHeader("Access-Control-Allow-Headers", "Content-Type");
  response.appendHeader("Content-Type", "application/json");

  if (event.request?.method === "OPTIONS") {
    return callback(null, response);
  }

  try {
    const { AccessToken } = require("twilio").jwt;
    const { VideoGrant } = AccessToken;

    const taskSid = event.taskSid;
    const workerName = event.workerName || "Agent";

    if (!taskSid) {
      response.setStatusCode(400);
      response.setBody({ error: "Missing taskSid" });
      return callback(null, response);
    }

    const roomName = `Room-${taskSid}`;
    const customerIdentity = `Customer-${taskSid}`;

    const agentToken = new AccessToken(
      context.ACCOUNT_SID,
      context.API_KEY,
      context.API_SECRET,
      { identity: workerName },
    );
    agentToken.addGrant(new VideoGrant({ room: roomName }));

    const customerToken = new AccessToken(
      context.ACCOUNT_SID,
      context.API_KEY,
      context.API_SECRET,
      { identity: customerIdentity },
    );
    customerToken.addGrant(new VideoGrant({ room: roomName }));

    response.setBody({
      agentToken: agentToken.toJwt(),
      customerToken: customerToken.toJwt(),
      roomName,
    });

    return callback(null, response);
  } catch (error) {
    response.setStatusCode(500);
    response.setBody({ error: "Internal Server Error" });
    return callback(null, response);
  }
};
```

---

## Required Environment Variables

Configure these in **Twilio Functions → Environment Variables**:

```
ACCOUNT_SID
API_KEY
API_SECRET
```

Create an API Key in:

Twilio Console → Settings → API Keys

---

# Video Room UI – `video-room.html`

Standalone Twilio Video UI page.

### Features

- Responsive 2-column layout
- No duplicate local video tracks
- Handles existing & new participants
- Clean disconnect handling
- Mobile responsive

```html
<!-- Use your full video-room.html file here -->
```

The page expects a token in the URL:

```
https://your-domain.twil.io/video-room.html?token=ACCESS_TOKEN
```

---

# Flex Plugin – `VideoEscalationPlugin.js`

Adds a **Video icon button** to the Task Canvas Header.

### What It Does

- Gets selected Task SID
- Calls `/get-tokens.js`
- Sends video link to customer
- Opens agent video window

```javascript
import React from "react";
import { FlexPlugin } from "@twilio/flex-plugin";
import { IconButton, Actions } from "@twilio/flex-ui";

const PLUGIN_NAME = "VideoEscalationPlugin";
const BASE_URL = "https://video-plugin-dummy-url.twil.io";

export default class VideoEscalationPlugin extends FlexPlugin {
  constructor() {
    super(PLUGIN_NAME);
  }

  init(flex, manager) {
    flex.TaskCanvasHeader.Content.add(
      <IconButton
        key="video-escalation-button"
        icon="Video"
        title="Start Video Call"
        variant="secondary"
        onClick={async () => {
          try {
            const state = manager.store.getState();
            const taskSid = state.flex.view.selectedTaskSid;
            if (!taskSid) return;

            const task = state.flex.worker.tasks.get(taskSid);
            if (!task) return;

            const conversationSid = task.attributes.conversationSid;
            if (!conversationSid) return;

            const token =
              manager.store.getState().flex.session.ssoTokenPayload.token;

            const workerName =
              manager.workerClient?.attributes?.full_name ||
              manager.workerClient?.name ||
              "Agent";

            const body = new URLSearchParams({
              taskSid,
              workerName,
              Token: token,
            });

            const response = await fetch(`${BASE_URL}/get-tokens.js`, {
              method: "POST",
              body,
              headers: {
                "Content-Type":
                  "application/x-www-form-urlencoded;charset=UTF-8",
              },
            });

            const data = await response.json();

            const customerLink = `${BASE_URL}/video-room.html?token=${data.customerToken}`;

            await Actions.invokeAction("SendMessage", {
              conversationSid,
              body: `I've started a secure video session.\nJoin here: ${customerLink}`,
            });

            window.open(
              `${BASE_URL}/video-room.html?token=${data.agentToken}`,
              "_blank",
              "width=1200,height=800",
            );
          } catch (err) {
            console.error("Video escalation failed:", err);
          }
        }}
      />,
      { sortOrder: 1, if: (props) => props.task },
    );
  }
}
```

---

# Installation

## Deploy Twilio Function

- Go to Twilio Console → Functions & Assets
- Add `get-tokens.js`
- Add `video-room.html` as Public Asset
- Set environment variables
- Deploy

## Install Flex Plugin

```bash
twilio flex:plugins:create video-escalation-plugin
cd video-escalation-plugin
```

Replace the generated plugin file with `VideoEscalationPlugin.js`.

Deploy:

```bash
twilio flex:plugins:deploy --major --changelog "Initial release"
```

Release:

```bash
twilio flex:plugins:release --plugin video-escalation-plugin@1.0.0
```

---

# Production Notes

- CORS enabled
- Room scoped to Task SID
- No duplicate track creation
- Secure token generation using API Key
- Works with WhatsApp, SMS, Webchat
- Supports Flex 2.x

---

# Optional Enhancements

- JWT validation inside Function
- Room participant limit
- Video recording
- Mute / camera toggle controls
- Auto-close video on task completion

---

# Final Result

✔ Flex 2.x plugin  
✔ Secure Twilio Video escalation  
✔ Conversation-based invite  
✔ Serverless backend  
✔ Clean responsive UI

---

## License

MIT

---

Built with ❤️ using Twilio Flex & Twilio Video
