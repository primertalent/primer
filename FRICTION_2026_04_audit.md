# Friction log — 2026-04-16 through 2026-04-23

Format: one line per friction. Timestamp, surface, what happened.
No fixing. No feature ideas. Just friction.

---
Candidate rejected from process. No where to select this and notate reason

Re-ran a screen against role and it gave a different score than when I ran it all together with 3. The screen against role button worked well, but is manual.  These things should be happening automatically. Same with parse resume for timeline. Too many button presses

Add to role from candidate card is impossible. Need to leave and manually do it. I am working with old candidates 

Tried a natural language prompt. It came with some smart first interactions but failed. Didn’t recognize the previously created candidate, company or role. Created new entries

Decided to delete everything that i had because roles, clients and candidates all had data from different process fflows

Big take away is that we need a consistent best work flow, or wren needs to be savvy enough to make any workflow work. 

Workflow fresh. I have a candidate I am speaking with tomorrow for a role. I am going to upload the candidate, the role, and compare him to it. I don’t have a resume yet because we havent spoke. I have his linkedin profile, so incomplete data. Here’s the flow I’m going to map out. Candidate is on my schedule for tomorrow, with calendar sync Wren knows that. If available, wren will pull that info for me. If not available, I have an action item. Andrew Plesman on calendar for tomorrow, want to add him to candidates? Yes (one click), results run him against current roles, tries to find a good match but doesnt, communicates that. Add him to new role? Yes, its a new role I had in mind for him but I hadn’t added the role yet, upload jd, company is created, insights on company are found and stored, roles is created, jd is stored and looks right. Andrew is compared to role, is a good fit, but there are some questions. I have those made for my call. Also, candidate materials are created. So I can share with Andrew important details and prep before our conversation. We speak, eventual auto notes, now pasted, Wren enriches the candidate data, creates our submittal to client. Is flexible on format. I send candidate off to client (eventual api or email connect). Wren knows that candidate is submitted now. Begins a countdown, ‘its been 2 days and we still havent heard back, I generated this message to the hiring manager, etc’. I review, edit a few, and send. (wren learns from my edit). Client responds and declines the candidate for X reasons, wren enriches the data of the candidate and the client/role. Rejected candidate with this type of background. Andrew moves to bench as a candidate in database with enriched notes. If I upload a role that he matches, wren will find him again a resurface, wren brings it to my attention and has a candidate outreach created to guage Andrews interest in the new role. The cycle repeats.

Doing things manual to test wren. pasted raw linkedin profile in 2 pastes. scored him a 6/10, I tend to agree, gave some concerns, created a correct next action based on what I gave it. Saved all
Realizing that we are ranking candidates overall AND as a fit for a role. Maybe we give candidates a Tier as an overall score, C-tier for 6 and below, B-tier for 7-8, A tier for 9, S -Tier for 10. This is helpful overall as we rank quality of candidate. Quality of candidate is different than fit as well. Most entry level employees will be C or B without exceptional factors like elite school, atheltic achievement etc. Tier candidates overall, rank candidates with fit scores per role. Different logic and appropriate.

Had to manually parse his experience. Career timeline needs UI work. Doesn't show promotions well if role different in same company

Role doesn't exist for him yet that I had in mind for him. So I am going to create it.

At create a role, click to create a role. this feels disconnected from Wren. I feel like I am working in any old ats. what if we just interact with wren here in a open prompt. Add a new role genrates a similar open text box as main. Wren says we can attach a jd, paste what we have, or free write. Maybe it asks us questions it can glean itself? But maybe not, maybe it flags actions if some things are missing, but these arent huge priorities. Pasted in a rough JD, it did a good job pulling the right info, but I then had to generate the JD with a click. It also didn't know to add Inworld as the client, that is left blank right now because the workflow in manual must be that I make the client first. Have to manual type Inworld for it to create a new client. Error: Invalid regular expression: /C++/i: Nothing to repeat . Role was saved twice as I clicked save twice with the error. Inworld was also created twice as a client. Okay, now I have a candidate, role and client. Going to candidate page to match him to the role. I can't role didnt save. Going to try to create the role from the main page instead. pasted raw notes, chip worked, typed 'new role'It generated a Unknown Candidate. Copy pasted output here: Unknown Candidate
View
Edit

GTM Lead · Inworld

✕
Strengths

Inworld builds real-time AI models for consumer-scale voice applications. Customers include NVIDIA, Microsoft Xbox, and Logitech Streamlabs.
This is the first GTM hire in the US. You report directly to the VP of Revenue and own both inbound PLG and enterprise sales from day one.
The team is 90 people with $125M raised from Lightspeed, Kleiner Perkins, Founders Fund, and Microsoft M12.
Next Action

Source candidates with 5 to 10 years in a customer-facing GTM or AE role who have sold AI, voice, or developer infrastructure products.

Answer

This is a new role submission for Inworld's GTM Lead search. No candidate has been attached. The role is a founding US GTM hire reporting to VP of Revenue Adel Farahmand. Inworld wants a hunter with direct experience selling voice AI, speech tech, or developer infrastructure to technical buyers. The hiring bar is high. Four candidates have already been screened out for reasons including limited AI or infra experience, a solutions engineering background instead of sales, and insufficient founding GTM experience. The best fit is someone who has built outbound from zero, sells to developers and CTOs comfortably, and has a clean upward progression in sales roles. Bay Area location is strongly preferred.

Role was saved but no info. Role was correctly assigned to previsouly created Inworld. Unknown candidate was also created. Deleted unknown candidate. Still trying to compare candidate to the role. Onto another step. opening up role thats empty and pasting the raw jd notes into notes. Generate JD click. Review and use this JD with another click. It didn't pull any info into the open text for compensation, etc. new page now, can click to format JD. doesn't real do anything, slight improvement. Role at least exists now. Back to candidate to compare. Screening against role with a click. 2/10, strong pass. I agree. His score history is logged, its called Unknown role... Interactions are empty when i told wren i had a call set with him in the beginning. End of this process. Not going to add him to the role because he is a poor fit. Really broken to get here though.