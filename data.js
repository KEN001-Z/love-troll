/*
  VYBE sample data.
  Everything in this file is fictional. Edit freely: script.js reads from VYBE_DATA.
*/
const VYBE_DATA = {

  /* ---------- Onboarding options ---------- */
  vibes: [
    { id: 'romance',    emoji: '❤️', label: 'Romance',                 text: 'Looking for a spark.' },
    { id: 'friendship', emoji: '🤝', label: 'Friendship',              text: 'New people, good conversations.' },
    { id: 'open',       emoji: '👀', label: 'Open to seeing what happens', text: 'No labels yet.' },
    { id: 'games',      emoji: '🎮', label: 'Just here for the games', text: 'Quizzes first, feelings later.' }
  ],

  interests: ['Music', 'Anime', 'Gaming', 'Movies', 'Sports', 'Technology', 'Food', 'Travel', 'Books'],

  /* ---------- Demo profiles (fictional adults) ----------
     "avatar" values describe the illustrated placeholder drawn in script.js. */
  profiles: [
    {
      id: 'amara', name: 'Amara', age: 24, place: 'Riverbend University (fictional)',
      looking: 'Open to seeing what happens',
      bio: 'Afrobeats on loud, jollof opinions louder. I will absolutely rate your playlist.',
      interests: ['Music', 'Food', 'Travel'],
      funFact: 'Has strong feelings about airport snacks.',
      firstHangout: 'A food market with no plan and a shared plate.',
      avatar: { skin: '#8d5a3b', hair: '#1c1420', style: 2, shirt: '#ff6b81', bg: ['#e4d7fb', '#c7b0f5'] }
    },
    {
      id: 'daniel', name: 'Daniel', age: 27, place: 'Harbour City (fictional)',
      looking: 'Friendship',
      bio: 'Backend developer by day, losing at co-op games by night. Looking for a reliable second player.',
      interests: ['Gaming', 'Technology', 'Movies'],
      funFact: 'Has never finished a game he bought on sale.',
      firstHangout: 'Board game café, loser buys the drinks.',
      avatar: { skin: '#e0b48f', hair: '#3b2a1e', style: 0, shirt: '#3a1170', bg: ['#fde3e6', '#f9c0c9'] }
    },
    {
      id: 'mina', name: 'Mina', age: 23, place: 'Northfield Campus (fictional)',
      looking: 'Romance',
      bio: 'Anime nights, rainy-day bookshops, and a very detailed list of favourite ramen spots.',
      interests: ['Anime', 'Books', 'Food'],
      funFact: 'Owns more bookmarks than books. Allegedly.',
      firstHangout: 'Bookshop browse, then ramen to argue about the endings.',
      avatar: { skin: '#f0cfae', hair: '#14101c', style: 1, shirt: '#6a3cc4', bg: ['#d9f2e6', '#b4e3cd'] }
    },
    {
      id: 'tobi', name: 'Tobi', age: 26, place: 'Riverbend University (fictional)',
      looking: 'Open to seeing what happens',
      bio: 'Five-a-side on Saturdays, football takes all week. Will cheer for you with unreasonable enthusiasm.',
      interests: ['Sports', 'Music', 'Food'],
      funFact: 'Has a victory dance for every occasion, including Tuesdays.',
      firstHangout: 'Kick-about in the park, then suya.',
      avatar: { skin: '#6f4430', hair: '#0f0b14', style: 3, shirt: '#ffb454', bg: ['#e4d7fb', '#d0bdf7'] }
    },
    {
      id: 'lucia', name: 'Lucía', age: 28, place: 'Harbour City (fictional)',
      looking: 'Romance',
      bio: 'Planning my next trip before the last one has ended. Fluent in sarcasm and decent Spanish.',
      interests: ['Travel', 'Movies', 'Books'],
      funFact: 'Has a rule: never book a flight without a snack plan.',
      firstHangout: 'Sunset walk and the worst-rated film on the streaming list.',
      avatar: { skin: '#d9a07a', hair: '#4a2a1a', style: 1, shirt: '#e23a57', bg: ['#fff1cc', '#ffe08a'] }
    },
    {
      id: 'sam', name: 'Sam', age: 25, place: 'Northfield Campus (fictional)',
      looking: 'Just here for the games',
      bio: 'Here for quizzes, chaos and unsolicited relationship opinions. Will ship your friends at a moment’s notice.',
      interests: ['Gaming', 'Anime', 'Technology'],
      funFact: 'Has been "five minutes away" since 2022.',
      firstHangout: 'Arcade tokens and honest trash talk.',
      avatar: { skin: '#f0cfae', hair: '#7a3f2b', style: 0, shirt: '#17694a', bg: ['#fde3e6', '#fbcdd4'] }
    },
    {
      id: 'priya', name: 'Priya', age: 29, place: 'Lakeside (fictional)',
      looking: 'Friendship',
      bio: 'Cooking for people is my love language. If you are hungry and nice, we will get along.',
      interests: ['Food', 'Music', 'Travel'],
      funFact: 'Can tell you the best dosa in any city she has visited.',
      firstHangout: 'Cook something ambitious together and fail gracefully.',
      avatar: { skin: '#b97a57', hair: '#1c1420', style: 1, shirt: '#3a1170', bg: ['#d9f2e6', '#c0ead8'] }
    },
    {
      id: 'jordan', name: 'Jordan', age: 24, place: 'Lakeside (fictional)',
      looking: 'Open to seeing what happens',
      bio: 'Indie films, bad puns, and a houseplant collection that is slowly taking over the flat.',
      interests: ['Movies', 'Books', 'Music'],
      funFact: 'Has named every plant. Some have last names.',
      firstHangout: 'Matinee screening and a debate in the lobby.',
      avatar: { skin: '#e8c3a0', hair: '#2a2a3a', style: 3, shirt: '#ff6b81', bg: ['#e4d7fb', '#cdbaf6'] }
    }
  ],

  /* ---------- Humour system ---------- */
  humour: {
    likes: [
      'Ohhh, so THIS is your type?',
      'Your taste has entered the chat.',
      'Cupid is taking notes.',
      'Bold choice. Cupid approves.',
      'Interesting. Very interesting. Noted.',
      'Your type has entered the chat.'
    ],
    skips: [
      'Not your vibe? Fair enough.',
      'Cupid respects your decision.',
      'On to the next chapter.',
      'Skipped with style.',
      'Next! No hard feelings.'
    ],
    copied: [
      'Copied. Go cause some chaos.',
      'Copied! Your group chat awaits.',
      'Done. Paste responsibly.'
    ],
    discoverEmpty: [
      'You have seen everyone in this demo. That is a whole era.',
      'End of the demo line. Cupid is filing the paperwork.',
      'That is all of them. Your romantic decisions have been forwarded to management.'
    ],
    onboardingDone: [
      'Looking good. Your VYBE era starts here.',
      'Main character energy detected. Welcome in.',
      'Profile preview complete. Cupid has requested a meeting.'
    ],
    shipLoading: [
      'Consulting Cupid…',
      'Checking the vibes…',
      'Reading the group chat…',
      'Hiding the wedding Pinterest board…'
    ]
  },

  /* ---------- Ship or Skip categories ----------
     Chosen by the compatibility percentage (min = lowest % that qualifies). */
  shipCategories: [
    { min: 0,  tone: 't4', emoji: '🪦', title: 'Cupid Has Resigned',
      lines: ['Cupid has resigned and left no forwarding address.', 'The universe suggests a very strong friendship, or separate pizzas.', 'Not a love story. Possibly a comedy about two people ordering different things.'] },
    { min: 16, tone: 't5', emoji: '📵', title: 'Mixed Signals Department',
      lines: ['Both of you are sending signals. Nobody is receiving them.', 'The chemistry is unclear. The reply times are not.', 'Somebody call the Mixed Signals Department. Bring snacks.'] },
    { min: 36, tone: 't6', emoji: '🤝', title: 'Best-Friend Energy',
      lines: ['This has best-friend energy with a side of "we should not text at 2 a.m."', 'Great company, great banter, zero panic. That is a good sign.', 'You would absolutely win a pub quiz together.'] },
    { min: 56, tone: 't3', emoji: '🌈', title: 'Delusional Romance',
      lines: ['Somebody hide the wedding Pinterest board.', 'The evidence is thin. The optimism is thick.', 'This pair has a lot of potential and an even larger imagination.'] },
    { min: 71, tone: 't2', emoji: '⚡', title: 'Dangerous Chemistry',
      lines: ['The chemistry is strong. The evidence is weak.', 'Sparks detected. Please keep away from open flames and group chats.', 'This much chemistry should come with a safety briefing.'] },
    { min: 86, tone: 't1', emoji: '💍', title: 'Married in Another Lifetime',
      lines: ['In another lifetime you shared a very opinionated couch.', 'The stars filed this one under "obviously".', 'Fictionally speaking, you two are a very good bit.'] }
  ],

  /* ---------- DELULU Meter ---------- */
  deluluQuestions: [
    {
      q: 'Your crush replies “😂😂”. What does that mean?',
      answers: [
        { text: 'They found my message funny.', score: 0 },
        { text: 'I should probably go outside.', score: 1 },
        { text: 'They are secretly in love with me.', score: 2 },
        { text: 'Our wedding is basically confirmed.', score: 3 }
      ]
    },
    {
      q: 'They liked a post of yours from three weeks ago. Your move?',
      answers: [
        { text: 'Smile and carry on with my day.', score: 0 },
        { text: 'Wonder if the app just misclicked.', score: 1 },
        { text: 'It is obviously a sign from the universe.', score: 2 },
        { text: 'Start drafting the engagement speech.', score: 3 }
      ]
    },
    {
      q: 'They say, “We should hang out sometime.”',
      answers: [
        { text: '“Sometime” is vague. I will suggest a real plan.', score: 0 },
        { text: 'Nice. I will wait and see.', score: 1 },
        { text: '“Sometime” definitely means Saturday.', score: 2 },
        { text: 'Time to choose a first-dance song.', score: 3 }
      ]
    },
    {
      q: 'They glance at you across the room for three seconds.',
      answers: [
        { text: 'They were probably looking at the clock.', score: 0 },
        { text: 'Nice, but I will not read into it.', score: 1 },
        { text: 'Eye contact is a language and we are fluent.', score: 2 },
        { text: 'We have shared a moment. I have named our future dog.', score: 3 }
      ]
    },
    {
      q: 'Their chat shows “typing…” and then stops.',
      answers: [
        { text: 'They got busy. It happens.', score: 0 },
        { text: 'I will check back tomorrow.', score: 1 },
        { text: 'They are nervous because of me.', score: 2 },
        { text: 'They are writing a paragraph about their feelings.', score: 3 }
      ]
    }
  ],

  /* Result is picked by total score (0 to 15). */
  deluluResults: [
    { max: 4, tone: 't6', emoji: '🌱', level: 1, title: 'Mildly Delusional',
      description: 'You hope a little, but your feet are firmly on the ground. A text is a text. A smile is a smile.',
      verdict: 'Healthy optimism, with receipts. Keep going.' },
    { max: 8, tone: 't5', emoji: '🎭', level: 2, title: 'Professionally Delusional',
      description: 'You can turn a three-word reply into a full storyline. The plot is good, to be fair.',
      verdict: 'Respectfully, let us gather more evidence.' },
    { max: 12, tone: 't3', emoji: '🔥', level: 3, title: 'Dangerously Optimistic',
      description: 'Your DELULU level is dangerously high. You have planned an entire relationship around a three-second eye contact.',
      verdict: 'You are not delusional. You are just creatively optimistic.' },
    { max: 15, tone: 't2', emoji: '🚀', level: 4, title: 'Reality Has Left the Chat',
      description: 'Reality tried to reach you, but you were busy choosing a wedding venue. The vision is impressive. The evidence is on holiday.',
      verdict: 'Your romantic decisions have been forwarded to management.' }
  ],

  /* ---------- VYBE Check ---------- */
  vybeQuestions: [
    {
      q: 'It is Friday night. Where are we?',
      answers: [
        { text: 'Somewhere everyone knows my name.', type: 'maincharacter' },
        { text: 'Hosting a calm dinner for friends.', type: 'greenflag' },
        { text: 'Texting three people “maybe”.', type: 'mixedsignals' },
        { text: 'Listening to a friend’s very long story.', type: 'therapist' }
      ]
    },
    {
      q: 'How do you text someone you like?',
      answers: [
        { text: 'Warm, honest and on time.', type: 'greenflag' },
        { text: 'A dramatic paragraph with a song attached.', type: 'romantic' },
        { text: 'Reply “lol” and disappear for a day.', type: 'mixedsignals' },
        { text: 'Whatever keeps them curious.', type: 'heartbreaker' }
      ]
    },
    {
      q: 'A friend says their crush is confusing. You…',
      answers: [
        { text: 'Open a full consultation with follow-up questions.', type: 'therapist' },
        { text: 'Suggest a handwritten letter.', type: 'romantic' },
        { text: 'Say “just be direct” and mean it.', type: 'greenflag' },
        { text: 'Gently steer the story towards me.', type: 'maincharacter' }
      ]
    },
    {
      q: 'Your best quality in love?',
      answers: [
        { text: 'Charm that arrives before I do.', type: 'heartbreaker' },
        { text: 'Loyalty and clear communication.', type: 'greenflag' },
        { text: 'I notice everything people feel.', type: 'therapist' },
        { text: 'I believe in grand gestures.', type: 'romantic' }
      ]
    },
    {
      q: 'Pick a movie vibe.',
      answers: [
        { text: 'A twisty thriller with unreliable narrators.', type: 'mixedsignals' },
        { text: 'A rom-com with a rain scene.', type: 'romantic' },
        { text: 'A heist where everyone looks incredible.', type: 'heartbreaker' },
        { text: 'An ensemble comedy where I am obviously the lead.', type: 'maincharacter' }
      ]
    },
    {
      q: 'How do you handle the end of a situationship?',
      answers: [
        { text: 'One clear, kind conversation.', type: 'greenflag' },
        { text: 'A mysterious voice note.', type: 'mixedsignals' },
        { text: 'A gentle debrief, tea included.', type: 'therapist' },
        { text: 'A dramatic walk away with a soundtrack.', type: 'heartbreaker' }
      ]
    }
  ],

  vybeResults: {
    heartbreaker: {
      tone: 't4', emoji: '🕶️', title: 'The Professional Heartbreaker',
      description: 'Magnetic, smooth, and always three steps ahead. People fall for you quickly, and you are very good at making an exit look like a movie scene.',
      verdict: 'Verdict: lovely company, please include a map.'
    },
    greenflag: {
      tone: 't6', emoji: '🟢', title: 'The Walking Green Flag',
      description: 'You say what you mean, reply when you said you would, and remember the small things. Some people find this suspicious. It is actually just rare.',
      verdict: 'Verdict: certified safe. Please do not change.'
    },
    mixedsignals: {
      tone: 't5', emoji: '📡', title: 'The CEO of Mixed Signals',
      description: 'Warm on Monday, mysterious by Wednesday. You are not trying to confuse anyone. Your calendar and your feelings just run on different time zones.',
      verdict: 'Verdict: the signal is strong. The meaning is unclear.'
    },
    therapist: {
      tone: 't1', emoji: '🛋️', title: 'The Unpaid Relationship Therapist',
      description: 'Everyone brings you their problems, and you give great advice. Your own love life is, naturally, the one case you never get to review.',
      verdict: 'Verdict: please book a session for yourself.'
    },
    romantic: {
      tone: 't3', emoji: '💌', title: 'The Delusional Romantic',
      description: 'You believe in handwritten letters, perfect timing, and a song that starts playing at the right moment. The world could use a few more of you.',
      verdict: 'Verdict: the soundtrack is ready. The other person is still choosing a shirt.'
    },
    maincharacter: {
      tone: 't2', emoji: '🎬', title: 'The Main Character',
      description: 'Every room has a spotlight and you tend to find it. You are generous, funny and memorable, and your friends have learned to keep the popcorn ready.',
      verdict: 'Verdict: the show must go on. Please thank the supporting cast.'
    }
  },
  /* Order used to break ties in the VYBE Check. */
  vybeTieOrder: ['greenflag', 'romantic', 'therapist', 'maincharacter', 'mixedsignals', 'heartbreaker']
};