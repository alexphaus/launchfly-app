const msgs = [
  "Thank you for contacting SQ(M) Home renovation International SDN BHD! Please let us know how we can help you.",
  "Thanks for contacting us! We will get back to you shortly.",
  "Hi, this is an automated reply. We are currently out of the office.",
  "Thanks for your message. We're currently closed.",
  "we are currently out of the office",
  "yes I am interested",
  "no thanks",
  "how much?",
  "who is this?"
];

const regex = /thank you for contacting|thanks for contacting|automated message|auto-?reply|out of (the )?office|currently closed|will get back to you|we are away|not in the office/i;

msgs.forEach(m => {
  console.log(`[${regex.test(m)}] ${m}`);
});
