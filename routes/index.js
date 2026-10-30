const express = require('express');
const router = express.Router();

/**
 * GET /
 * Render SweetPlay homepage prototype
 */
router.get('/', (req, res) => {
  const pageData = {
    title: 'SweetPlay | College Social Gaming Hub',
    activeNav: 'play',
    brandName: 'SweetPlay',
    tagline: 'Play with your campus. Meet players beyond it when you choose.',
    description: 'The social gaming lounge built for college students. Jump into casual gaming sessions with classmates or team up with players across universities.',
    campusOptions: [
      {
        id: 'my-campus',
        name: 'My campus',
        tag: 'Campus Exclusive',
        icon: 'campus',
        description: 'Connect and queue strictly with students from your own college.',
        verificationNote: 'Will require college email or another approved verification method. (Verification is not implemented in this prototype.)',
        isDefault: true
      },
      {
        id: 'any-campus',
        name: 'Any campus',
        tag: 'Inter-Collegiate',
        icon: 'globe',
        description: 'Play across universities, challenge rival colleges, or expand your gaming circle nationwide.',
        verificationNote: 'Includes students from other colleges to discover matches beyond your local campus. (Verification is not implemented in this prototype.)',
        isDefault: false
      }
    ],
    studentBenefits: [
      {
        icon: '🎓',
        title: 'Play with your campus (Future Feature)',
        description: 'Jump into gaming sessions exclusively with students from your own college — perfect for dorm rivalries, campus clubs, and casual hangout games.'
      },
      {
        icon: '🌐',
        title: 'Challenge other campuses (Future Feature)',
        description: 'When you want broader competition, switch to Any campus to connect and play with student gamers across other universities whenever you choose.'
      },
      {
        icon: '⚡',
        title: 'Quick casual sessions (Future Feature)',
        description: 'Designed around student life for fast, casual gaming during breaks between classes or study sessions without complicated setups.'
      }
    ],
    prototypeBadge: 'Prototype Demo',
    prototypeNotice: 'UI & Layout Prototype: Live matchmaking, campus authentication, and game lobbies are not active in this preview.',
    demoStatusText: 'Demo only — no match is being created'
  };

  res.render('index', pageData);
});

module.exports = router;
