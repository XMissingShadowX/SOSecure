---
name: handoff
description: Summarize the conversation into a plain text handoff brief for a new chat session.
trigger: whenever the user types "handoff" or asks to summarize the chat for a new session, run this skill automatically.
---
When triggered, go through the full conversation and produce a plain text block the user can copy and paste into a new chat. Include these five sections:
 
Who this is for — One or two sentences on who the user is and what they're working on.
 
What we covered — Paragraph summarizing main topics and decisions.
 
What was confirmed — Key facts, conclusions, and agreements.
 
Still in progress — Anything unfinished, flagged, or uncertain.
 
Next steps — What to focus on in the next session.
 
Instructions: Write in plain text only with no markdown or bullet points. Use concise, specific sentences. Remove filler and repetition. Do not add or assume anything that was not explicitly discussed. Summarize accurately based only on the conversation. Write as a handoff brief for a new Claude instance with no prior context. Organize the information clearly with short labeled sections. After generating the handoff, tell the user they can edit any section before pasting it into a new chat.
 
