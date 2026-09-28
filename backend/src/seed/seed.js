require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Load models safely
const loadModel = (name, schema) => {
  try {
    return mongoose.model(name);
  } catch (e) {
    if (schema) return mongoose.model(name, schema);
    return require(`../models/${name}`);
  }
};

const seed = async () => {
  try {
    const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/feedants_competition';
    await mongoose.connect(MONGO_URI);
    console.log('Connected to MongoDB');

    const User = loadModel('User');
    const Competition = loadModel('Competition');

    let Judge;
    try { Judge = loadModel('Judge'); } catch (e) { }

    let Registration, Review, Winner;
    try { Registration = require('../models/Registration'); } catch (e) { }
    try { Review = require('../models/Review'); } catch (e) { }
    try { Winner = loadModel('Winner'); } catch (e) { }

    // Clear existing data
    await User.deleteMany({});
    await Competition.deleteMany({});
    if (Judge) await Judge.deleteMany({});
    if (Registration) await Registration.deleteMany({});
    if (Review) await Review.deleteMany({});
    if (Winner) await Winner.deleteMany({});
    console.log('Cleared existing data');

    // Create Judge with 12+ years experience as per spec
    let judgeDoc;
    if (Judge) {
      judgeDoc = await Judge.create({
        name: 'Manju Dubey',
        nameHindi: 'मंजू दुबे',
        photoUrl: 'https://randomuser.me/api/portraits/women/44.jpg',
        title: 'Professional Kathak Dancer',
        titleHindi: 'पेशेवर कथक नर्तक',
        experienceYears: 12,
        introVideoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
        bio: 'Renowned Kathak dancer with 12+ years of experience in classical dance.'
      });
      console.log('Created Judge');
    }

    // Create Users
    const passwordHash = await bcrypt.hash('password123', 10);
    const users = await User.create([
      {
        name: 'Priya Sharma',
        email: 'priya@feedants.com',
        passwordHash,
        role: 'USER',
        referralCode: 'PRIYA123'
      },
      {
        name: 'Rohan Verma',
        email: 'rohan@feedants.com',
        passwordHash,
        role: 'USER',
        referralCode: 'ROHAN123'
      },
      {
        name: 'Admin User',
        email: 'admin@feedants.com',
        passwordHash,
        role: 'ADMIN',
        referralCode: 'ADMIN123'
      }
    ]);
    const priya = users[0];
    const rohan = users[1];
    console.log('Created Users');

    // Prepare Judge for Competition based on schema
    // The Competition schema expects an ObjectId reference to Judge
    const competitionJudge = judgeDoc ? judgeDoc._id : null;

    // Prepare Rewards based on schema
    const rawRewards = [
      { rank: 1, title: '1st Winner', titleHindi: 'प्रथम विजेता', amount: 550 },
      { rank: 2, title: '2nd Winner', titleHindi: 'द्वितीय विजेता', amount: 300 },
      { rank: 3, title: '3rd Winner', titleHindi: 'तृतीय विजेता', amount: 240 },
      { rank: 4, title: '4th Winner', titleHindi: 'चतुर्थ विजेता', amount: 200 },
      { rank: 5, title: '5th Winner', titleHindi: 'पंचम विजेता', amount: 130 },
      { rank: 6, title: '6th Winner', titleHindi: 'षष्ठम विजेता', amount: 80 }
    ];

    let compRewards = [];
    if (Competition.schema.paths.rewards) {
      const rewardSchema = Competition.schema.paths.rewards.schema;
      if (rewardSchema && rewardSchema.paths.rank) {
        compRewards = rawRewards.map(r => ({ rank: r.rank, title: r.title, titleHindi: r.titleHindi, amount: r.amount }));
      } else {
        compRewards = rawRewards.map(r => ({ position: r.rank, title: r.title, titleHindi: r.titleHindi, prizeAmount: r.amount }));
      }
    } else {
      compRewards = rawRewards.map(r => ({ position: r.rank, title: r.title, titleHindi: r.titleHindi, prizeAmount: r.amount }));
    }

    // Create Competition with all required fields
    const now = new Date();
    // Set dates relative to now to match spec: registration closes in ~1d 6h, submission starts ~4d ago, ends ~20d from now, results ~22d from now
    const registerBeforeAt = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000 + 6 * 60 * 60 * 1000 + 28 * 60 * 1000 + 32 * 1000);
    const submissionStartAt = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000 - 19 * 60 * 60 * 1000 - 50 * 60 * 1000);
    const submissionEndAt = new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000 + 5 * 60 * 1000);
    const resultAt = new Date(now.getTime() + 22 * 24 * 60 * 60 * 1000);

    const compData = {
      title: 'Feedants Classical Dance',
      titleHindi: 'फीडेंट्स क्लासिकल डांस',
      category: 'Dance',
      categoryHindi: 'नृत्य',
      isMultiWin: true,
      certificateForWinners: true,
      prizePool: 1500,
      entryFee: 99,
      totalSpots: 20,
      bookedSpots: 1,
      judge: competitionJudge,
      registerBeforeAt: registerBeforeAt,
      submissionStartAt: submissionStartAt,
      submissionEndAt: submissionEndAt,
      resultAt: resultAt,
      status: 'registration_open',
      rewards: compRewards,
      description: 'This is an online classical dance competition open for all age groups. Participate from anywhere and showcase your talent. Express your passion through traditional dance.',
      descriptionHindi: 'यह एक ऑनलाइन शास्त्रीय नृत्य प्रतियोगिता है जो सभी आयु समूहों के लिए खुली है। कहीं से भी भाग लें और अपनी प्रतिभा का प्रदर्शन करें। पारंपरिक नृत्य के माध्यम से अपने जुनून को व्यक्त करें।',
      judgingParameters: [
        { name: 'Expressions', nameHindi: 'भाव', weightage: 30, description: 'Facial expressions and emotional portrayal' },
        { name: 'Rhythm', nameHindi: 'ताल', weightage: 40, description: 'Timing and rhythmic accuracy' },
        { name: 'Costume', nameHindi: 'पोशाक', weightage: 30, description: 'Appropriateness and aesthetics of costume' }
      ],
      rules: ['Video must be 2-3 minutes long', 'No editing allowed', 'Audio must be clear'],
      rulesHindi: ['वीडियो 2-3 मिनट लंबा होना चाहिए', 'संपादन की अनुमति नहीं है', 'ऑडियो स्पष्ट होना चाहिए'],
      eligibility: ['Open to all age groups', 'Amateur dancers only'],
      eligibilityHindi: ['सभी आयु समूहों के लिए खुला', 'केवल शौकिया नर्तक'],
      disclaimer: 'Only contributions from paid participants will be considered for judging.',
      disclaimerHindi: 'केवल सशुल्क प्रतिभागियों के योगदान को ही मूल्यांकन के लिए माना जाएगा।',
      introVideoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
      prizeInfoVideoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
      refundPolicyText: 'Full refund guaranteed if competition is cancelled by organizer.',
      refundPolicyHindi: 'यदि आयोजक द्वारा प्रतियोगिता रद्द की जाती है तो पूर्ण धनवापसी की गारंटी।',
      language: 'ENG'
    };

    const comp = await Competition.create(compData);
    console.log('Created Competition');

    // Create Registration for Priya
    if (Registration) {
      await Registration.create({
        user: priya._id,
        competition: comp._id,
        status: 'confirmed',
        razorpayPaymentId: 'pay_mock123',
        amountPaid: 99
      });
      console.log('Created Registration');
    }

    // Create Reviews
    if (Review) {
      await Review.create([
        { user: priya._id, userName: priya.name, rating: 5, comment: 'Amazing platform!', competitionCategory: 'Classical Dance' },
        { user: rohan._id, userName: rohan.name, rating: 4.5, comment: 'Great experience overall.', competitionCategory: 'Classical Dance' }
      ]);
      console.log('Created Reviews');
    }

    // Create Previous Winners with performanceVideoUrl
    if (Winner) {
      await Winner.create([
        { competition: comp._id, name: 'Riya Shah', profileImage: 'https://randomuser.me/api/portraits/women/10.jpg', position: '1st Winner', rank: 1, prizeAmount: 550, performanceVideoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4' },
        { competition: comp._id, name: 'Aarav Mehta', profileImage: 'https://randomuser.me/api/portraits/men/20.jpg', position: '1st Winner', rank: 1, prizeAmount: 550, performanceVideoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4' },
        { competition: comp._id, name: 'Neha Verma', profileImage: 'https://randomuser.me/api/portraits/women/30.jpg', position: '2nd Winner', rank: 2, prizeAmount: 300, performanceVideoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4' },
        { competition: comp._id, name: 'Ishita Chopra', profileImage: 'https://randomuser.me/api/portraits/women/40.jpg', position: '3rd Winner', rank: 3, prizeAmount: 240, performanceVideoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4' }
      ]);
      console.log('Created Winners');
    }

    // Also update the competition with previousWinners array for backward compatibility
    await Competition.findByIdAndUpdate(comp._id, {
      previousWinners: [
        { rank: 1, name: 'Riya Shah', photoUrl: 'https://randomuser.me/api/portraits/women/10.jpg', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4' },
        { rank: 1, name: 'Aarav Mehta', photoUrl: 'https://randomuser.me/api/portraits/men/20.jpg', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4' },
        { rank: 2, name: 'Neha Verma', photoUrl: 'https://randomuser.me/api/portraits/women/30.jpg', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4' },
        { rank: 3, name: 'Ishita Chopra', photoUrl: 'https://randomuser.me/api/portraits/women/40.jpg', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4' }
      ]
    });
    console.log('Updated Competition with previousWinners');

    console.log('Seed completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seed();
