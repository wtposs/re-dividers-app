// Firebase Configuration (YOUR ACTUAL CONFIG)
const firebaseConfig = {
    apiKey: "AIzaSyD1g2UheB0iuhUXTl52b0uDVtfrMgeNrrk",
    authDomain: "re-dividers-app2.firebaseapp.com",
    projectId: "re-dividers-app2",
    storageBucket: "re-dividers-app2.firebasestorage.app",
    messagingSenderId: "889185919958",
    appId: "1:889185919958:web:305adbbfb5d787c3aa7a77",
    measurementId: "G-V52FQRJ075" // Including measurementId as it was in your snippet
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
const analytics = firebase.analytics(); // Initialize Analytics

// Firebase UI configuration
const uiConfig = {
    callbacks: {
        signInSuccessWithAuthResult: function(authResult, redirectUrl) {
            return true; // Return type determines whether we continue the redirect automatically
        },
        uiShown: function() {
            document.getElementById('loader').style.display = 'none';
        }
    },
    signInFlow: 'popup', // 'popup' or 'redirect'
    signInOptions: [
        firebase.auth.GoogleAuthProvider.PROVIDER_ID,
        firebase.auth.EmailAuthProvider.PROVIDER_ID,
        // You can add other providers here
    ],
    tosUrl: '<your-tos-url>', // Terms of Service URL (replace if you have one)
    privacyPolicyUrl: '<your-privacy-policy-url>' // Privacy Policy URL (replace if you have one)
};

// Get references to HTML elements
const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app-container');
const loginNameSpan = document.getElementById('login-name');
const logoutButton = document.getElementById('logout-button');
const signInPrompt = document.getElementById('sign-in-prompt');
const questionContainer = document.getElementById('question-container');
const checkAnswersButton = document.getElementById('check-answers-button');
const messageBox = document.getElementById('message-box');
const timerDisplay = document.getElementById('timer-display'); // Main continuous timer
const resetButton = document.getElementById('reset-button');
const showAnswersButton = document.getElementById('show-answers-button');


let questions = []; // Array to hold questions
let timerInterval;
let startTime;


// --- Firebase Authentication ---
auth.onAuthStateChanged(function(user) {
    if (user) {
        // User is signed in.
        loginContainer.style.display = 'none';
        appContainer.style.display = 'block';
        loginNameSpan.textContent = user.displayName || user.email;
        signInPrompt.style.display = 'none';
        fetchAndRenderQuestions();
    } else {
        // User is signed out.
        loginContainer.style.display = 'block';
        appContainer.style.display = 'none';
        loginNameSpan.textContent = '';
        signInPrompt.style.display = 'block';
        // Initialize FirebaseUI if not already initialized
        if (!ui) {
            ui = new firebaseui.auth.AuthUI(firebase.auth());
        }
        ui.start('#firebaseui-auth-container', uiConfig);
    }
});

logoutButton.addEventListener('click', function() {
    auth.signOut();
});


// --- Question Management Functions ---
async function fetchAndRenderQuestions() {
    try {
        const docRef = db.collection("artifacts").doc("homophone-challenge-app-v1")
                         .collection("public").doc("data");
        const doc = await docRef.get();

        if (doc.exists && doc.data().homophone_questions && doc.data().homophone_questions.length > 0) {
            questions = doc.data().homophone_questions;
            renderAllQuestions(questions);
        } else {
            // Document does not exist or has no questions, so populate
            console.log("No questions found in Firestore, populating from hardcoded list.");
            const initialQuestions = getInitialHardcodedQuestions();
            if (initialQuestions.length > 0) {
                await docRef.set({ homophone_questions: initialQuestions });
                questions = initialQuestions; // Set questions from initial list
                renderAllQuestions(questions);
                showMessage("Questions populated to Firestore!", "success");
            } else {
                showMessage("No questions found or hardcoded. Please add questions to Firestore.", "error");
            }
        }
    } catch (error) {
        console.error("Error fetching or populating questions:", error);
        showMessage("Error loading questions. Check console for details.", "error");
    }
    resetGame(); // Always reset the game state after fetching/rendering questions
}


function renderAllQuestions(fetchedQuestions) {
    questionContainer.innerHTML = ''; // Clear existing questions
    questions = fetchedQuestions; // Update global questions array

    questions.forEach((q, index) => {
        const questionDiv = document.createElement("div");
        questionDiv.className = "question";
        questionDiv.setAttribute("data-index", index); // Store original index

        let sentence1Html = `<p><strong>${index + 1}.</strong> ${q.sentence1.replace(/___+/g, `<input type="text" id="answer${(index * 2) + 1}" placeholder="Answer" class="medium">`)}</p>`;
        let sentence2Html;

        // Handle cases with multiple blanks (like question 6 and 11)
        if (Array.isArray(q.answer2)) {
            if (index === 5) { // Question 6 (index 5) has two blanks in sentence2
                sentence2Html = `<p>And then the Triumphal <input type="text" id="answer${(index * 2) + 2}" placeholder="Answer" class="small">.<span class="large-period">.</span> <input type="text" id="text" id="answer${(index * 2) + 3}" placeholder="Answer" class="small"> never seen anything so impressive.</p>`;
            } else if (index === 10) { // Question 11 (index 10) has two blanks in sentence2
                sentence2Html = `<p>She can do lettering, illustrations, patterns, <input type="text" id="answer${(index * 2) + 2}" placeholder="Answer" class="small"><span class="large-period">.</span><span style="padding: 0 5px;"></span> <input type="text" id="answer${(index * 2) + 3}" placeholder="Answer" class="small"> talents are truly limitless.</p>`;
            } else { // Fallback for single blank in sentence2 for other questions (shouldn't be needed with 22 Qs)
                sentence2Html = `<p>${q.sentence2.replace(/___+/g, `<input type="text" id="answer${(index * 2) + 2}" placeholder="Answer" class="medium">`)}</p>`;
            }
        } else { // Standard single blank for sentence2
            sentence2Html = `<p>${q.sentence2.replace(/___+/g, `<input type="text" id="answer${(index * 2) + 2}" placeholder="Answer" class="medium">`)}</p>`;
        }


        questionDiv.innerHTML = sentence1Html + sentence2Html;
        questionContainer.appendChild(questionDiv);
    });
}

// --- Check Answers ---
checkAnswersButton.addEventListener('click', checkAnswers);

function checkAnswers() {
    let correctCount = 0;
    let totalBlanks = 0;

    questions.forEach((q, index) => {
        const input1 = document.getElementById(`answer${(index * 2) + 1}`);
        const input2 = document.getElementById(`answer${(index * 2) + 2}`);

        const answer1User = input1.value.trim().toLowerCase();
        let answer2User;

        // Handle multiple blanks for q.answer2
        if (Array.isArray(q.answer2)) {
            const input3 = document.getElementById(`answer${(index * 2) + 3}`); // For the third blank
            answer2User = [input2.value.trim().toLowerCase(), input3.value.trim().toLowerCase()];
            totalBlanks += 2; // Two blanks for these questions
        } else {
            answer2User = input2.value.trim().toLowerCase();
            totalBlanks += 1; // One blank for standard questions
        }

        let isCorrect1 = answer1User === q.answer1.toLowerCase();
        let isCorrect2;

        if (Array.isArray(q.answer2)) {
            isCorrect2 = answer2User[0] === q.answer2[0].toLowerCase() &&
                         answer2User[1] === q.answer2[1].toLowerCase();
        } else {
            isCorrect2 = answer2User === q.answer2.toLowerCase();
        }

        input1.classList.remove('correct', 'incorrect');
        input2.classList.remove('correct', 'incorrect');
        if (Array.isArray(q.answer2)) {
            const input3 = document.getElementById(`answer${(index * 2) + 3}`);
            input3.classList.remove('correct', 'incorrect');
        }

        if (isCorrect1) {
            input1.classList.add('correct');
            correctCount++;
        } else {
            input1.classList.add('incorrect');
        }

        if (isCorrect2) {
            input2.classList.add('correct');
            if (Array.isArray(q.answer2)) {
                const input3 = document.getElementById(`answer${(index * 2) + 3}`);
                input3.classList.add('correct');
                correctCount += 2; // Increment by 2 for two correct blanks
            } else {
                correctCount++;
            }
        } else {
            input2.classList.add('incorrect');
            if (Array.isArray(q.answer2)) {
                const input3 = document.getElementById(`answer${(index * 2) + 3}`);
                input3.classList.add('incorrect');
            }
        }
    });

    const totalQuestions = questions.length;

    // Calculate and format the frozen elapsed time
    const currentElapsedTimeMs = Date.now() - startTime;
    const minutes = Math.floor(currentElapsedTimeMs / 60000);
    const seconds = Math.floor((currentElapsedTimeMs % 60000) / 1000);
    const frozenTimeFormatted = `<span class="math-inline">\{minutes\}\:</span>{seconds.toString().padStart(2, '0')}`;

    let scoreMsg;
    if (correctCount === totalBlanks) {
        scoreMsg = `All answers correct! Great job!`;
    } else {
        scoreMsg = `You got ${correctCount} out of ${totalBlanks} blanks correct.`;
    }
    // Append the frozen time to the message
    scoreMsg += ` Time elapsed: ${frozenTimeFormatted}`;

    showMessage(scoreMsg, 'info');
}

// --- Hardcoded Questions (Your 22 Questions) ---
function getInitialHardcodedQuestions() {
    return [
        {
            sentence1: "When Martha's neighbor played his CD music after midnight, no one could calm her down. She was ____.",
            answer1: "disconsolate",
            sentence2: "She was very upset that he put the ____.",
            answer2: "disc on so late",
        },
        {
            sentence1: "Even a Supreme Court ____ needs an occasional break.",
            answer1: "justice",
            sentence2: "Sotomayor takes her tea without lemon or sugar; she has it with ____.",
            answer2: "just ice",
        },
        {
            sentence1: "My dog couldn't control his bladder in the house and peed on my ____.",
            answer1: "carpet",
            sentence2: "Now he stays in my automobile. He's a ____.",
            answer2: "car pet",
        },
        {
            sentence1: "Jennifer was suspicious of the police officers huddled ____.",
            answer1: "together",
            sentence2: "She was sure they were out ____.",
            answer2: "to get her",
        },
        {
            sentence1: "It took hours, but Tom finally shaved off his beard and ____.",
            answer1: "mustache",
            sentence2: "I really think his arm ____ from all the effort.",
            answer2: "must ache",
        },
        {
            sentence1: "In Paris I visited the National ____.",
            answer1: "archive",
            sentence2: "And then the Triumphal ____. ____ never seen anything so impressive.",
            answer2: ["arch", "ive"], // Example of multiple blanks
        },
        {
            sentence1: "You shouldn't sit around and let your muscles ____.",
            answer1: "atrophy",
            sentence2: "You'd better train for the marathon if you want to win ____.",
            answer2: "a trophy",
        },
        {
            sentence1: "Wearing her crown adorned with oval and ____ sapphires, the listless queen felt undecided.",
            answer1: "orbed",
            sentence2: "Should she go to the banquet ____?",
            answer2: "or bed",
        },
        {
            sentence1: "The clumsy chemist ____ and spilled the slimy serum on the floor.",
            answer1: "goofed",
            sentence2: "Overnight, this ____ a swarm of ants that then gained superpowers.",
            answer2: "goo fed",
        },
        {
            sentence1: "The old deer was exhausted and his legs nearly ____.",
            answer1: "buckled",
            sentence2: "Still, the ____ his herd through the dense forest to safety.",
            answer2: "buck led",
        },
        {
            sentence1: "With acid and a metal plate, she’s an ____ like no other.",
            answer1: "etcher",
            sentence2: "She can do lettering, illustrations, patterns, ____. ____ talents are truly limitless.",
            answer2: ["etc", "her"], // Example of multiple blanks
        },
        {
            sentence1: "My ____ other insists on a prenup before marriage.",
            answer1: "significant",
            sentence2: "I don’t agree, but I’ll ____ change her mind.",
            answer2: "sign if i can't",
        },
        {
            sentence1: "The athlete suffered a direct hit to his left ____ during the game.",
            answer1: "testis",
            sentence2: "A medical ____ required to ensure full recovery.",
            answer2: "test is",
        },
        {
            sentence1: "I stopped watching Game of Thrones. You've seen one ____, you've seen them all.",
            answer1: "dragon",
            sentence2: "After a couple seasons, the series seemed to ____.",
            answer2: "drag on",
        },
        {
            sentence1: "You say you’re fed up, that I've been ____ to prove my feelings since our freshman year?",
            answer1: "promising",
            sentence2: "You'll see when at the ____ you a love ballad.",
            answer2: "prom i sing",
        },
        {
            sentence1: "The queen can’t stop ____ about how her husband has changed for the better.",
            answer1: "thinking",
            sentence2: "The newly ____ is the picture of health.",
            answer2: "thin king",
        },
        {
            sentence1: "The picnic was going great, with me winning 21-16 at ____.",
            answer1: "badminton",
            sentence2: "But when it came time to eat, with one taste I knew I'd put ____ the lamb.",
            answer2: "bad mint on",
        },
        {
            sentence1: "Our pet Misty deems depressed and appears ____, staring blankly at the wall for hours.",
            answer1: "catatonic",
            sentence2: "We need to give that ____ for her nerves.",
            answer2: "cat a tonic",
        },
        {
            sentence1: "I stayed with my mother's older brother and he was appalled at how ____ I left the room.",
            answer1: "unclean",
            sentence2: "I felt terrible and gave my ____ apology.",
            answer2: "uncle an",
        },
        {
            sentence1: "What you don’t do to help endangered animals may doom them like the ____ bird.",
            answer1: "dodo",
            sentence2: "What you ____ can ensure their survival for years to come.",
            answer2: "do do",
        },
        {
            sentence1: "The stylist took one look at Henry's brittle nails, and asked if he'd like to add keratin treatments to his ____.",
            answer1: "manicure",
            sentence2: "She added, \"I assure you, every ____ of this condition says it's well worth the cost!\"",
            answer2: "man i cure",
        },
        {
            sentence1: "Dangerously, the tiny boat began to ____ in the storm.",
            answer1: "capsize",
            sentence2: "Engine problems arose as the wrong ____ on the fuel tank let in seawater.",
            answer2: "cap size",
        },
    ];
}


// --- Timer Functions ---
function startTimer() {
    if (timerInterval) clearInterval(timerInterval); // Clear any existing timer
    startTime = Date.now();
    timerInterval = setInterval(updateTimer, 1000);
}

function updateTimer() {
    const elapsedTime = Date.now() - startTime;
    const minutes = Math.floor(elapsedTime / 60000);
    const seconds = Math.floor((elapsedTime % 60000) / 1000);
    timerDisplay.textContent = `Timer: <span class="math-inline">\{minutes\}\:</span>{seconds.toString().padStart(2, '0')}`; // Main continuous timer
}

function stopTimer() {
    clearInterval(timerInterval);
}

function resetGame() {
    // Clear all input fields
    const inputs = questionContainer.querySelectorAll('input[type="text"]');
    inputs.forEach(input => {
        input.value = '';
        input.classList.remove('correct', 'incorrect');
    });

    stopTimer();
    timerDisplay.textContent = 'Timer: 0:00'; // Reset main timer display
    showMessage('', 'none'); // Clear message box (which includes frozen time)
    startTimer(); // Restart the main timer for a new game
}

// --- Event Listeners ---
resetButton.addEventListener('click', resetGame);
showAnswersButton.addEventListener('click', showAnswers);

function showAnswers() {
    questions.forEach((q, index) => {
        const input1 = document.getElementById(`answer${(index * 2) + 1}`);
        const input2 = document.getElementById(`answer${(index * 2) + 2}`);

        input1.value = q.answer1;
        input1.classList.remove('correct', 'incorrect'); // Clear styling

        if (Array.isArray(q.answer2)) {
            const input3 = document.getElementById(`answer${(index * 2) + 3}`);
            input2.value = q.answer2[0];
            input3.value = q.answer2[1];
            input2.classList.remove('correct', 'incorrect');
            input3.classList.remove('correct', 'incorrect');
        } else {
            input2.value = q.answer2;
            input2.classList.remove('correct', 'incorrect');
        }
    });
    stopTimer(); // Stop the timer when answers are shown
    showMessage("Answers revealed. Click Reset to play again.", "info");
}


// --- DOMContentLoaded ---
document.addEventListener('DOMContentLoaded', () => {
    // Check if FirebaseUI is already initialized before starting
    if (!window.ui) {
        window.ui = new firebaseui.auth.AuthUI(firebase.auth());
    }

    if (auth.currentUser) {
        // If already signed in, fetch questions immediately
        fetchAndRenderQuestions();
    } else {
        // If not signed in, show login UI
        ui.start('#firebaseui-auth-container', uiConfig);
    }
});