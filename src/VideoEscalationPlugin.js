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
            if (!conversationSid) {
              console.error("No conversationSid found");
              return;
            }

            // Get the Flex JWT token
            const token =
              manager.store.getState().flex.session.ssoTokenPayload.token;

            const workerName =
              manager.workerClient?.attributes?.full_name ||
              manager.workerClient?.name ||
              "Agent";

            // Build form body
            const body = new URLSearchParams({
              taskSid,
              workerName,
              Token: token, // add token for validation
            });

            const response = await fetch(`${BASE_URL}/get-tokens.js`, {
              method: "POST",
              body,
              headers: {
                "Content-Type":
                  "application/x-www-form-urlencoded;charset=UTF-8",
              },
            });

            if (!response.ok) {
              throw new Error("Failed to get tokens");
            }

            const data = await response.json();

            const customerLink = `${BASE_URL}/video-room.html?token=${data.customerToken}`;

            // Send message via conversation
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
            alert("Unable to start video session");
          }
        }}
      />,
      { sortOrder: 1, if: (props) => props.task },
    );
  }
}
