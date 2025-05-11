function formatDate(date) {
    try {
        if (!date) return '';
        if (!(date instanceof Date)) return date;
        if (isNaN(date.getTime())) return ''; // Check for invalid date
        
        const options = { year: 'numeric', month: 'long', day: 'numeric' };
        return date.toLocaleDateString('en-GB', options);
    } catch (error) {
        console.error('Error formatting date:', error, 'Date value:', date);
        return '';
    }
}

// Default settings
const DEFAULT_SETTINGS = {
    cranialUltrasound: {
        gestation: 28,
        weight: 1.5,
        followUpGestation: 29,
        followUpWeight: 1.0,
        initialDay: 3,
        followUpDay: 28
    },
    medications: {
        hydrocortisoneGestation: 28,
        hydrocortisoneReviewDay: 10,
        probioticsGestation: 32,
        probioticsWeight: 1.5,
        caffeineGestation: 32,
        caffeineReviewGestation: 34,
        sytronWeight: 2.5,
        sytronStartDay: 28
    },
    feeding: {
        pnGestation: 30,
        pnWeight: 1.25,
        pnReviewDay: 5,
        trophicGestation: 27,
        trophicWeight: 0.8,
        breastMilkIncrementGestation: 29,
        breastMilkIncrementWeight: 1.5,
        fortifierGestation: 32
    }
};

// Initialize IndexedDB
const dbName = 'milestonesDB';
const dbVersion = 1;
let db;

const initDB = () => {
    return new Promise((resolve, reject) => {
        console.log('Starting database initialization...');
        if (db) {
            console.log('Database already initialized');
            resolve(db);
            return;
        }

        const request = indexedDB.open(dbName, dbVersion);

        request.onerror = (event) => {
            console.error('IndexedDB error:', event.target.error);
            console.error('IndexedDB error details:', {
                name: event.target.error.name,
                message: event.target.error.message
            });
            reject(event.target.error);
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log('IndexedDB initialized successfully');
            console.log('Database name:', db.name);
            console.log('Database version:', db.version);
            console.log('Object stores:', Array.from(db.objectStoreNames));
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            console.log('Database upgrade needed');
            const db = event.target.result;
            
            try {
                // Create stores if they don't exist
                if (!db.objectStoreNames.contains('calculations')) {
                    console.log('Creating calculations store');
                    db.createObjectStore('calculations', { keyPath: 'id', autoIncrement: true });
                }
                if (!db.objectStoreNames.contains('settings')) {
                    console.log('Creating settings store');
                    db.createObjectStore('settings', { keyPath: 'id' });
                }
                console.log('Database upgrade completed successfully');
            } catch (error) {
                console.error('Error during database upgrade:', error);
                throw error;
            }
        };
    });
};

// Ensure database is ready
async function ensureDatabase() {
    if (!db) {
        console.log('Database not initialized, initializing now...');
        try {
            await initDB();
            console.log('Database initialized successfully');
            // Initialize with default settings if needed
            const transaction = db.transaction(['settings'], 'readonly');
            const store = transaction.objectStore('settings');
            const settings = await store.get('userSettings');
            if (!settings) {
                console.log('No settings found, adding defaults...');
                const defaultSettings = {
                    id: 'userSettings',
                    cranialUltrasound: DEFAULT_SETTINGS.cranialUltrasound,
                    medications: DEFAULT_SETTINGS.medications,
                    feeding: DEFAULT_SETTINGS.feeding
                };
                const writeTransaction = db.transaction(['settings'], 'readwrite');
                const writeStore = writeTransaction.objectStore('settings');
                await writeStore.add(defaultSettings);
                console.log('Default settings added successfully');
            }
        } catch (error) {
            console.error('Failed to initialize database:', error);
            throw new Error('Database initialization failed: ' + error.message);
        }
    }
    return db;
}

// Save calculation results to IndexedDB
const saveCalculation = (data) => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['calculations'], 'readwrite');
        const store = transaction.objectStore('calculations');
        const calculationData = {
            ...data,
            timestamp: new Date().toISOString(),
            needsSync: !navigator.onLine // Mark for sync if offline
        };
        
        const request = store.add(calculationData);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

// Get previous calculations from IndexedDB
const getCalculations = () => {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(['calculations'], 'readonly');
        const store = transaction.objectStore('calculations');
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

// Save milestone settings to localStorage
async function saveMilestoneSettings() {
    const settings = {
        id: 'userSettings',
        cranialUltrasound: {
            gestation: parseFloat(document.getElementById('cranialUltrasoundGestation').value) || 28,
            weight: parseFloat(document.getElementById('cranialUltrasoundWeight').value) || 1.5,
            followUpGestation: parseFloat(document.getElementById('cranialUltrasoundFollowUpGestation').value) || 29,
            followUpWeight: parseFloat(document.getElementById('cranialUltrasoundFollowUpWeight').value) || 1.0,
            initialDay: parseInt(document.getElementById('cranialUltrasoundInitialDay').value) || 3,
            followUpDay: parseInt(document.getElementById('cranialUltrasoundFollowUpDay').value) || 28
        },
        medications: {
            hydrocortisoneGestation: parseFloat(document.getElementById('hydrocortisoneGestation').value) || DEFAULT_SETTINGS.medications.hydrocortisoneGestation,
            hydrocortisoneReviewDay: parseInt(document.getElementById('hydrocortisoneReviewDay').value) || DEFAULT_SETTINGS.medications.hydrocortisoneReviewDay,
            probioticsGestation: parseFloat(document.getElementById('probioticsGestation').value) || DEFAULT_SETTINGS.medications.probioticsGestation,
            probioticsWeight: parseFloat(document.getElementById('probioticsWeight').value) || DEFAULT_SETTINGS.medications.probioticsWeight,
            caffeineGestation: parseFloat(document.getElementById('caffeineGestation').value) || DEFAULT_SETTINGS.medications.caffeineGestation,
            caffeineReviewGestation: parseFloat(document.getElementById('caffeineReviewGestation').value) || DEFAULT_SETTINGS.medications.caffeineReviewGestation,
            sytronWeight: parseFloat(document.getElementById('sytronWeight').value) || DEFAULT_SETTINGS.medications.sytronWeight,
            sytronStartDay: parseInt(document.getElementById('sytronStartDay').value) || DEFAULT_SETTINGS.medications.sytronStartDay
        },
        feeding: {
            pnGestation: parseFloat(document.getElementById('pnGestation').value) || DEFAULT_SETTINGS.feeding.pnGestation,
            pnWeight: parseFloat(document.getElementById('pnWeight').value) || DEFAULT_SETTINGS.feeding.pnWeight,
            trophicGestation: parseFloat(document.getElementById('trophicGestation').value) || DEFAULT_SETTINGS.feeding.trophicGestation,
            trophicWeight: parseFloat(document.getElementById('trophicWeight').value) || DEFAULT_SETTINGS.feeding.trophicWeight,
            breastMilkIncrementGestation: parseFloat(document.getElementById('breastMilkIncrementGestation').value) || DEFAULT_SETTINGS.feeding.breastMilkIncrementGestation,
            breastMilkIncrementWeight: parseFloat(document.getElementById('breastMilkIncrementWeight').value) || DEFAULT_SETTINGS.feeding.breastMilkIncrementWeight,
            fortifierGestation: parseFloat(document.getElementById('fortifierGestation').value) || DEFAULT_SETTINGS.feeding.fortifierGestation
        }
    };

    try {
        const transaction = db.transaction(['settings'], 'readwrite');
        const store = transaction.objectStore('settings');
        await store.put(settings);
        alert('Settings saved successfully');
    } catch (error) {
        console.error('Error saving settings:', error);
        alert('Failed to save settings. Please try again.');
    }
}

// Load milestone settings from IndexedDB
async function loadMilestoneSettings() {
    try {
        const transaction = db.transaction(['settings'], 'readonly');
        const store = transaction.objectStore('settings');
        const settings = await store.get('userSettings');

        if (settings) {
            // Load values into form
            document.getElementById('cranialUltrasoundGestation').value = settings.cranialUltrasound.gestation;
            document.getElementById('cranialUltrasoundWeight').value = settings.cranialUltrasound.weight;
            document.getElementById('cranialUltrasoundInitialDay').value = settings.cranialUltrasound.initialDay;
            document.getElementById('cranialUltrasoundFollowUpDay').value = settings.cranialUltrasound.followUpDay;
            document.getElementById('cranialUltrasoundFollowUpGestation').value = settings.cranialUltrasound.followUpGestation;
            document.getElementById('cranialUltrasoundFollowUpWeight').value = settings.cranialUltrasound.followUpWeight;
            
            // Medication settings
            document.getElementById('hydrocortisoneGestation').value = settings.medications.hydrocortisoneGestation;
            document.getElementById('hydrocortisoneReviewDay').value = settings.medications.hydrocortisoneReviewDay;
            document.getElementById('probioticsGestation').value = settings.medications.probioticsGestation;
            document.getElementById('probioticsWeight').value = settings.medications.probioticsWeight;
            document.getElementById('caffeineGestation').value = settings.medications.caffeineGestation;
            document.getElementById('caffeineReviewGestation').value = settings.medications.caffeineReviewGestation;
            document.getElementById('sytronWeight').value = settings.medications.sytronWeight;
            document.getElementById('sytronStartDay').value = settings.medications.sytronStartDay;
            
            // Feeding settings
            document.getElementById('pnGestation').value = settings.feeding.pnGestation;
            document.getElementById('pnWeight').value = settings.feeding.pnWeight;
            document.getElementById('trophicGestation').value = settings.feeding.trophicGestation;
            document.getElementById('trophicWeight').value = settings.feeding.trophicWeight;
            document.getElementById('breastMilkIncrementGestation').value = settings.feeding.breastMilkIncrementGestation;
            document.getElementById('breastMilkIncrementWeight').value = settings.feeding.breastMilkIncrementWeight;
            document.getElementById('fortifierGestation').value = settings.feeding.fortifierGestation;
        } else {
            // Silently initialize with defaults without showing confirmation
            const transaction = db.transaction(['settings'], 'readwrite');
            const store = transaction.objectStore('settings');
            
            const defaultSettings = {
                id: 'userSettings',
                cranialUltrasound: DEFAULT_SETTINGS.cranialUltrasound,
                medications: DEFAULT_SETTINGS.medications,
                feeding: DEFAULT_SETTINGS.feeding
            };
            await store.add(defaultSettings);
            
            // Load the default values into the form
            document.getElementById('cranialUltrasoundGestation').value = defaultSettings.cranialUltrasound.gestation;
            document.getElementById('cranialUltrasoundWeight').value = defaultSettings.cranialUltrasound.weight;
            document.getElementById('cranialUltrasoundInitialDay').value = defaultSettings.cranialUltrasound.initialDay;
            document.getElementById('cranialUltrasoundFollowUpDay').value = defaultSettings.cranialUltrasound.followUpDay;
            document.getElementById('cranialUltrasoundFollowUpGestation').value = defaultSettings.cranialUltrasound.followUpGestation;
            document.getElementById('cranialUltrasoundFollowUpWeight').value = defaultSettings.cranialUltrasound.followUpWeight;
            
            document.getElementById('hydrocortisoneGestation').value = defaultSettings.medications.hydrocortisoneGestation;
            document.getElementById('hydrocortisoneReviewDay').value = defaultSettings.medications.hydrocortisoneReviewDay;
            document.getElementById('probioticsGestation').value = defaultSettings.medications.probioticsGestation;
            document.getElementById('probioticsWeight').value = defaultSettings.medications.probioticsWeight;
            document.getElementById('caffeineGestation').value = defaultSettings.medications.caffeineGestation;
            document.getElementById('caffeineReviewGestation').value = defaultSettings.medications.caffeineReviewGestation;
            document.getElementById('sytronWeight').value = defaultSettings.medications.sytronWeight;
            document.getElementById('sytronStartDay').value = defaultSettings.medications.sytronStartDay;
            
            document.getElementById('pnGestation').value = defaultSettings.feeding.pnGestation;
            document.getElementById('pnWeight').value = defaultSettings.feeding.pnWeight;
            document.getElementById('trophicGestation').value = defaultSettings.feeding.trophicGestation;
            document.getElementById('trophicWeight').value = defaultSettings.feeding.trophicWeight;
            document.getElementById('breastMilkIncrementGestation').value = defaultSettings.feeding.breastMilkIncrementGestation;
            document.getElementById('breastMilkIncrementWeight').value = defaultSettings.feeding.breastMilkIncrementWeight;
            document.getElementById('fortifierGestation').value = defaultSettings.feeding.fortifierGestation;
        }
    } catch (error) {
        console.error('Error loading settings:', error);
        // Silently use defaults without showing confirmation
        const defaultSettings = {
            id: 'userSettings',
            cranialUltrasound: DEFAULT_SETTINGS.cranialUltrasound,
            medications: DEFAULT_SETTINGS.medications,
            feeding: DEFAULT_SETTINGS.feeding
        };
        
        // Load the default values into the form without saving to DB (since there was an error)
        document.getElementById('cranialUltrasoundGestation').value = defaultSettings.cranialUltrasound.gestation;
        document.getElementById('cranialUltrasoundWeight').value = defaultSettings.cranialUltrasound.weight;
        document.getElementById('cranialUltrasoundInitialDay').value = defaultSettings.cranialUltrasound.initialDay;
        document.getElementById('cranialUltrasoundFollowUpDay').value = defaultSettings.cranialUltrasound.followUpDay;
        document.getElementById('cranialUltrasoundFollowUpGestation').value = defaultSettings.cranialUltrasound.followUpGestation;
        document.getElementById('cranialUltrasoundFollowUpWeight').value = defaultSettings.cranialUltrasound.followUpWeight;
        
        document.getElementById('hydrocortisoneGestation').value = defaultSettings.medications.hydrocortisoneGestation;
        document.getElementById('hydrocortisoneReviewDay').value = defaultSettings.medications.hydrocortisoneReviewDay;
        document.getElementById('probioticsGestation').value = defaultSettings.medications.probioticsGestation;
        document.getElementById('probioticsWeight').value = defaultSettings.medications.probioticsWeight;
        document.getElementById('caffeineGestation').value = defaultSettings.medications.caffeineGestation;
        document.getElementById('caffeineReviewGestation').value = defaultSettings.medications.caffeineReviewGestation;
        document.getElementById('sytronWeight').value = defaultSettings.medications.sytronWeight;
        document.getElementById('sytronStartDay').value = defaultSettings.medications.sytronStartDay;
        
        document.getElementById('pnGestation').value = defaultSettings.feeding.pnGestation;
        document.getElementById('pnWeight').value = defaultSettings.feeding.pnWeight;
        document.getElementById('trophicGestation').value = defaultSettings.feeding.trophicGestation;
        document.getElementById('trophicWeight').value = defaultSettings.feeding.trophicWeight;
        document.getElementById('breastMilkIncrementGestation').value = defaultSettings.feeding.breastMilkIncrementGestation;
        document.getElementById('breastMilkIncrementWeight').value = defaultSettings.feeding.breastMilkIncrementWeight;
        document.getElementById('fortifierGestation').value = defaultSettings.feeding.fortifierGestation;
    }
}

// Reset settings to defaults
async function resetDefaultSettings() {
    if (window.confirm('Are you sure you want to reset all settings to their default values? This cannot be undone.')) {
        try {
            const transaction = db.transaction(['settings'], 'readwrite');
            const store = transaction.objectStore('settings');
            await store.delete('userSettings');
            
            // Add default settings
            const defaultSettings = {
                id: 'userSettings',
                cranialUltrasound: DEFAULT_SETTINGS.cranialUltrasound,
                medications: DEFAULT_SETTINGS.medications,
                feeding: DEFAULT_SETTINGS.feeding
            };
            await store.add(defaultSettings);
            
            // Reload settings in the form
            await loadMilestoneSettings();
        } catch (error) {
            console.error('Error resetting settings:', error);
        }
    }
}

// Load settings when the settings page is shown
function showSettingsPage() {
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('settingsPage').style.display = 'block';
    loadMilestoneSettings();
}

// Show main content function
function showMainContent() {
    document.getElementById('settingsPage').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
}

// Get current settings from IndexedDB
async function getCurrentSettings() {
    try {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(['settings'], 'readonly');
            const store = transaction.objectStore('settings');
            const request = store.get('userSettings');
            
            request.onsuccess = () => {
                const settings = request.result || DEFAULT_SETTINGS;
                console.log('Retrieved settings:', settings);
                resolve(settings);
            };
            
            request.onerror = () => {
                console.error('Error getting settings:', request.error);
                resolve(DEFAULT_SETTINGS);
            };
        });
    } catch (error) {
        console.error('Error in getCurrentSettings:', error);
        return DEFAULT_SETTINGS;
    }
}

// Validate user input at the start
function validateUserInput() {
    const gestationWeeks = parseInt(document.getElementById('gestationWeeks').value, 10);
    const gestationDays = parseInt(document.getElementById('gestationDays').value, 10);
    const weight = parseFloat(document.getElementById('weight').value);

    let errorMessage = '';
  
    if (isNaN(weight) || weight < 0.3 || weight > 6) {
        errorMessage += 'Birth Weight must be between 0.3 and 6 kg.\n';
    }

    if (isNaN(gestationWeeks) || gestationWeeks < 20 || gestationWeeks > 45) {
        errorMessage += 'Gestation (Weeks) must be between 20 and 45.\n';
    }

    if (isNaN(gestationDays) || gestationDays < 0 || gestationDays > 7) {
        errorMessage += 'Gestation (Days) must be between 0 and 7.\n';
    }

    if (errorMessage) {
        alert(errorMessage);
        return false;
    }

    return true;
}

// Call validateUserInput before calculating milestones
async function calculateMilestones() {
    try {
        console.log('Starting milestone calculation...');

        if (!validateUserInput()) {
            console.log('Input validation failed');
            return;
        }
        console.log('Input validation passed');

        // Ensure database is ready
        await ensureDatabase();

        // Get current settings first
        console.log('Fetching current settings...');
        const settings = await getCurrentSettings();
        console.log('Settings retrieved:', settings);

        // Get form values
        const patientName = document.getElementById('patientName').value;
        const nhsNumber = document.getElementById('nhsNumber').value;
        const dob = new Date(document.getElementById('dob').value);
        const weight = parseFloat(document.getElementById('weight').value);
        const gestationWeeks = parseInt(document.getElementById('gestationWeeks').value, 10);
        const gestationDays = parseInt(document.getElementById('gestationDays').value, 10);

        console.log('Form values:', {
            patientName,
            nhsNumber,
            dob,
            weight,
            gestationWeeks,
            gestationDays
        });

        if (!dob || isNaN(weight) || isNaN(gestationWeeks) || isNaN(gestationDays)) {
            console.log('Required fields missing or invalid');
            alert('Please fill in all the fields.');
            return;
        }

        // Clear any previous output
        const outputDiv = document.getElementById('output');
        outputDiv.innerHTML = '';

        // Initialize arrays
        console.log('Initializing milestone arrays...');
        const correctedGestations = [];
        const newbornExaminations = [];
        const bloodspotTests = [];
        const cranialUltrasounds = [];
        const medications = [];
        const feedingGuidelines = [];
        const immunisations = [];
        const ropScreening = [];
        const miscellaneousDates = [];
        const researchStudies = [];

        // Calculate corrected gestational milestones
        console.log('Calculating corrected gestations...');
        const gestationMilestones = [30, 32, 34, 36, 38, 40];
        gestationMilestones.forEach(weeks => {
            if (weeks > gestationWeeks) {
                const daysToAdd = (weeks - gestationWeeks) * 7 - gestationDays;
                const milestoneDate = new Date(dob);
                milestoneDate.setDate(milestoneDate.getDate() + daysToAdd);
                correctedGestations.push({ milestone: `${weeks} weeks`, date: milestoneDate });
            }
        });
        console.log('Corrected gestations:', correctedGestations);

        // Newborn examination date
        const day3 = new Date(dob);
        day3.setDate(day3.getDate() + 3);
        newbornExaminations.push({ milestone: 'Newborn examination (by day 3)', date: day3 });

        if (gestationWeeks < 34) {
            const corrected34Weeks = new Date(dob);
            corrected34Weeks.setDate(corrected34Weeks.getDate() + (34 - gestationWeeks) * 7 - gestationDays);
            newbornExaminations.push({ milestone: 'Newborn examination (34 weeks corrected)', date: corrected34Weeks });
        }

        // Newborn bloodspot testing
        const day5 = new Date(dob);
        day5.setDate(day5.getDate() + 5);
        bloodspotTests.push({ milestone: 'Newborn blood spot test (day 5)', date: day5 });
        if (gestationWeeks < 32) {
            const day28 = new Date(dob);
            day28.setDate(day28.getDate() + 28);
            bloodspotTests.push({ milestone: 'Newborn blood spot test (day 28)', date: day28 });
        }

        // Cranial ultrasound tests using custom thresholds
        if (gestationWeeks < settings.cranialUltrasound.gestation || weight < settings.cranialUltrasound.weight) {
            const initialScanDay = new Date(dob);
            initialScanDay.setDate(initialScanDay.getDate() + settings.cranialUltrasound.initialDay);
            cranialUltrasounds.push({ milestone: `Cranial ultrasound (day ${settings.cranialUltrasound.initialDay})`, date: initialScanDay });

            cranialUltrasounds.push({ milestone: 'Cranial ultrasound (before discharge)', date: 'Before Discharge' });

            if (gestationWeeks < settings.cranialUltrasound.followUpGestation || weight < settings.cranialUltrasound.followUpWeight) {
                const followUpScanDay = new Date(dob);
                followUpScanDay.setDate(followUpScanDay.getDate() + settings.cranialUltrasound.followUpDay);
                cranialUltrasounds.push({ milestone: `Cranial ultrasound (day ${settings.cranialUltrasound.followUpDay})`, date: followUpScanDay });
            }
        }

        // Medications using custom thresholds
        if (gestationWeeks < settings.medications.hydrocortisoneGestation) {
            const hydrocortisoneReview = new Date(dob);
            hydrocortisoneReview.setDate(hydrocortisoneReview.getDate() + settings.medications.hydrocortisoneReviewDay);
            medications.push({ milestone: `Hydrocortisone review (day ${settings.medications.hydrocortisoneReviewDay})`, date: hydrocortisoneReview });
        }

        if (gestationWeeks < settings.medications.probioticsGestation || weight < settings.medications.probioticsWeight) {
            const correctedReviewWeeks = new Date(dob);
            correctedReviewWeeks.setDate(correctedReviewWeeks.getDate() + (settings.medications.caffeineReviewGestation - gestationWeeks) * 7 - gestationDays);
            medications.push({ milestone: 'Probiotics start', date: 'Commence when tolerating at least 0.5ml of milk every 2 hours' });
            medications.push({ milestone: `Probiotics review (${settings.medications.caffeineReviewGestation} weeks corrected)`, date: correctedReviewWeeks });
        }

        if (gestationWeeks < settings.medications.caffeineGestation) {
            const correctedCaffeineReview = new Date(dob);
            correctedCaffeineReview.setDate(correctedCaffeineReview.getDate() + (settings.medications.caffeineReviewGestation - gestationWeeks) * 7 - gestationDays);
            medications.push({ milestone: `Caffeine review (${settings.medications.caffeineReviewGestation} weeks corrected)`, date: correctedCaffeineReview });
        } else {
            medications.push({ milestone: 'Caffeine', date: 'Not routinely indicated' });
        }

        if (weight < settings.medications.sytronWeight) {
            const sytronStart = new Date(dob);
            sytronStart.setDate(sytronStart.getDate() + settings.medications.sytronStartDay);
            medications.push({ milestone: `Sytron start (day ${settings.medications.sytronStartDay})`, date: sytronStart, note: 'Do not use if receiving formula or fortifier' });
            medications.push({ milestone: 'Abidec', date: 'Commence when tolerating full feeds. Do not use if receiving formula' });
        }

        // Feeding Guidelines using custom thresholds
        if (gestationWeeks < settings.feeding.pnGestation || weight < settings.feeding.pnWeight) {
            feedingGuidelines.push({ milestone: 'Parenteral Nutrition', date: 'Start within 6 hours of birth' });
        } else {
            feedingGuidelines.push({ milestone: 'Parenteral Nutrition', date: 'Consider if not reaching 100 ml/kg/day by Day 5' });
        }

        // Initial Feeding Rate - Breast Milk using custom thresholds
        if (gestationWeeks < settings.feeding.trophicGestation || weight < settings.feeding.trophicWeight) {
            feedingGuidelines.push({ milestone: 'Breast Milk - Initial Feeding Rate', date: 'Trophic Expressed Breast Milk (EBM)' });
        } else if (gestationWeeks < 30 || weight < 1) {
            feedingGuidelines.push({ milestone: 'Breast Milk - Initial Feeding Rate', date: '15 ml/kg/day' });
        } else if (weight < 1.501 || gestationWeeks < settings.feeding.fortifierGestation) {
            feedingGuidelines.push({ milestone: 'Breast Milk - Initial Feeding Rate', date: '30 ml/kg/day' });
        } else {
            feedingGuidelines.push({ milestone: 'Breast Milk - Initial Feeding Rate', date: 'Full enteral feeds' });
        }

        // Breast Milk Increment Rate
        if (gestationWeeks < settings.feeding.trophicGestation || weight < settings.feeding.trophicWeight) {
            feedingGuidelines.push({ milestone: 'Breast Milk - Increment Rate', date: 'Consider Trophic EBM' });
        } else if (gestationWeeks > settings.feeding.breastMilkIncrementGestation && weight > settings.feeding.breastMilkIncrementWeight) {
            feedingGuidelines.push({ milestone: 'Breast Milk - Increment Rate', date: 'Increase as tolerated' });
        } else {
            feedingGuidelines.push({ milestone: 'Breast Milk - Increment Rate', date: '30 ml/kg/24h' });
        }

        // Initial Feeding Rate - Formula Milk
        if (gestationWeeks < 30 || weight < 1) {
            feedingGuidelines.push({ milestone: 'Formula Milk - Initial Feeding Rate', date: 'Avoid formula use' });
        } else if (weight < 1.25 || gestationWeeks < 32) {
            feedingGuidelines.push({ milestone: 'Formula Milk - Initial Feeding Rate', date: '20 ml/kg/day starting Day 3' });
        } else if (weight <= 1.5 && gestationWeeks > 31) {
            feedingGuidelines.push({ milestone: 'Formula Milk - Initial Feeding Rate', date: '20 ml/kg/day starting Day 1' });
        } else {
            feedingGuidelines.push({ milestone: 'Formula Milk - Initial Feeding Rate', date: 'Full enteral feeds' });
        }

        // Formula Milk Increment Rate
        if (gestationWeeks < 30 || weight < 1) {
            feedingGuidelines.push({ milestone: 'Formula Milk - Increment Rate', date: 'Avoid formula use' });
        } else if (weight < 1.25 || gestationWeeks < 32) {
            feedingGuidelines.push({ milestone: 'Formula Milk - Increment Rate', date: '20 ml/kg/day' });
        } else if (weight <= 1.5 && gestationWeeks > 31) {
            feedingGuidelines.push({ milestone: 'Formula Milk - Increment Rate', date: '20 ml/kg/day' });
        } else {
            feedingGuidelines.push({ milestone: 'Formula Milk - Increment Rate', date: 'Increase as tolerated' });
        }

        // Immunisations
        const eightWeeks = new Date(dob);
        eightWeeks.setDate(eightWeeks.getDate() + 8 * 7);
        immunisations.push({ milestone: '8-week immunisations', date: eightWeeks });

        const twelveWeeks = new Date(dob);
        twelveWeeks.setDate(twelveWeeks.getDate() + 12 * 7);
        immunisations.push({ milestone: '12-week immunisations', date: twelveWeeks });

        const sixteenWeeks = new Date(dob);
        sixteenWeeks.setDate(sixteenWeeks.getDate() + 16 * 7);
        immunisations.push({ milestone: '16-week immunisations', date: sixteenWeeks });

        const twelveMonths = new Date(dob);
        twelveMonths.setMonth(twelveMonths.getMonth() + 12);
        immunisations.push({ milestone: '12-month immunisations', date: twelveMonths });

        // ROP Screening Calculations
        let screeningStart;
        if (gestationWeeks < 27) {
            // Calculate 30 weeks corrected date directly
            const daysTo30Weeks = (30 - gestationWeeks) * 7 - gestationDays;
            screeningStart = new Date(dob);
            screeningStart.setDate(screeningStart.getDate() + daysTo30Weeks + 7); // Add 7 days after reaching 30 weeks
        } else if (gestationWeeks < 31) {
            screeningStart = new Date(dob);
            screeningStart.setDate(screeningStart.getDate() + 28);
        } else if (weight <= 1.5 && gestationWeeks < 32) {
            screeningStart = new Date(dob);
            screeningStart.setDate(screeningStart.getDate() + 28);
        } else if (weight <= 1.5 && gestationWeeks < 36) {
            // Calculate 36 weeks corrected date directly
            const daysTo36Weeks = (36 - gestationWeeks) * 7 - gestationDays;
            screeningStart = new Date(dob);
            screeningStart.setDate(screeningStart.getDate() + daysTo36Weeks);
        } else if (weight <= 1.5 && gestationWeeks > 35) {
            screeningStart = new Date(dob);
        } else if (gestationWeeks === 31 && weight > 1.5) {
            screeningStart = "Consider ROP Screening";
        } else {
            screeningStart = "Not Indicated";
        }

        let screeningDue;
        if (screeningStart === "Consider ROP Screening") {
            screeningDue = new Date(dob);
            screeningDue.setDate(screeningDue.getDate() + 35);
        } else if (screeningStart instanceof Date) {
            screeningDue = new Date(screeningStart);
            screeningDue.setDate(screeningDue.getDate() + 7);
        } else {
            screeningDue = screeningStart; // "Not Indicated"
        }

        ropScreening.push({ milestone: 'ROP screening window start', date: screeningStart instanceof Date ? formatDate(screeningStart) : screeningStart });
        ropScreening.push({ milestone: 'First ROP screening due before', date: screeningDue instanceof Date ? formatDate(screeningDue) : screeningDue });

        // Newborn Hearing Screening
        miscellaneousDates.push({ milestone: 'Newborn Hearing Screening', date: 'Before Discharge' });

        // Day 100
        const day100 = new Date(dob);
        day100.setDate(day100.getDate() + 100);
        miscellaneousDates.push({ milestone: 'Day 100 of Life', date: day100 });

        // Research Studies
        if (gestationWeeks < 34) {
            researchStudies.push({ milestone: 'NeoGASTRIC', date: 'Consider participation' });
        }
        if (gestationWeeks < 30) {
            researchStudies.push({ milestone: 'WHEAT', date: 'Consider participation' });
        }
        if (gestationWeeks < 31) {
            researchStudies.push({ milestone: 'BASE', date: 'Consider participation' });
        }
        if (gestationWeeks >= 34 && gestationWeeks <= 38) {
            researchStudies.push({ milestone: 'SurfON', date: 'Consider participation' });
        }

        console.log('Generating table...');
        // Generate output table
        const table = document.createElement('table');
        
        const addGroupToTable = (group, groupName) => {
            console.log(`Adding group: ${groupName}`);
            console.log('Group data:', group);
            
            const groupHeader = document.createElement('tr');
            groupHeader.innerHTML = `<th colspan="2">${groupName}</th>`;
            table.appendChild(groupHeader);

            group.forEach(({ milestone, date, note }) => {
                const row = document.createElement('tr');
                const dateContent = date instanceof Date ? formatDate(date) : date || '';
                row.innerHTML = `<td>${milestone}</td><td>${dateContent}${note ? ` - ${note}` : ''}</td>`;
                table.appendChild(row);
            });
        };

        // Add all groups to table
        try {
            addGroupToTable(correctedGestations, 'Corrected Gestation');
            addGroupToTable(newbornExaminations, 'Newborn Examination');
            addGroupToTable(bloodspotTests, 'Newborn Blood Spot Test');
            addGroupToTable(cranialUltrasounds, 'Cranial Ultrasound');
            addGroupToTable(medications, 'Medication');
            addGroupToTable(feedingGuidelines, 'Feeding - See separate guidelines for cardiac and surgical newborns');
            addGroupToTable(immunisations, 'Immunisations');
            addGroupToTable(ropScreening, 'Retinopathy of Prematurity (ROP) Screening');
            addGroupToTable(miscellaneousDates, 'Miscellaneous Dates');
            addGroupToTable(researchStudies, 'Research Studies');
            
            console.log('Table generated successfully');
            outputDiv.appendChild(table);

            // Save calculation
            const calculationData = {
                patientName: document.getElementById('patientName').value,
                nhsNumber: document.getElementById('nhsNumber').value,
                dob: document.getElementById('dob').value,
                weight: document.getElementById('weight').value,
                gestationWeeks: document.getElementById('gestationWeeks').value,
                gestationDays: document.getElementById('gestationDays').value,
                results: document.getElementById('output').innerHTML
            };

            console.log('Saving calculation...');
            await saveCalculation(calculationData);
            console.log('Calculation saved successfully');
            
        } catch (error) {
            console.error('Error in table generation:', error);
            throw error; // Re-throw to be caught by outer try-catch
        }
    } catch (error) {
        console.error('Error calculating milestones:', error);
        console.error('Error stack:', error.stack);
        alert('An error occurred while calculating milestones. Please check the console for details and try again.');
    }
}

function validatePassword() {
    const password = document.getElementById('passwordInput').value;
    const correctPassword = 'test'; // Replace with your desired password

    if (password === correctPassword) {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainContent').style.display = 'block';
    } else {
        const errorElement = document.getElementById('loginError');
        errorElement.style.display = 'block';
    }
}

function setTodaysDate() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('dob').value = today;
}

function formatForPrint() {
    const printWindow = window.open('', '_blank');
    printWindow.document.write('<html><head><title>Neonatal Care Calculator</title>');
    printWindow.document.write('<style>');
    printWindow.document.write(`
        body { 
            font-family: Arial, sans-serif; 
            margin: 20px; 
            font-size: 11px;
            max-width: 800px;
            margin: 0 auto;
        }
        h1 { 
            text-align: center; 
            color: #005eb8; 
            font-size: 16px; 
            margin-bottom: 15px; 
        }
        .demographics-container {
            display: flex;
            justify-content: space-between;
            margin-bottom: 20px;
            padding: 10px;
            border-bottom: 2px solid #005eb8;
        }
        .demographics-left, .demographics-right {
            flex: 1;
        }
        .demographics-container p {
            margin: 5px 0;
        }
        table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 10px; 
            page-break-inside: auto;
        }
        tr { 
            page-break-inside: avoid; 
            page-break-after: auto;
        }
        th, td { 
            border: 1px solid #ccc; 
            padding: 4px 8px; 
            text-align: left; 
            font-size: 11px; 
        }
        th { 
            background-color: #f2f2f2; 
        }
        @media print {
            body { margin: 15mm; }
            .demographics-container { break-after: avoid; }
        }
    `);
    printWindow.document.write('</style></head><body>');

    // Add title
    printWindow.document.write('<h1>Neonatal Care Calendar</h1>');

    // Add demographics in two columns
    printWindow.document.write('<div class="demographics-container">');
    
    // Left column - Patient details
    printWindow.document.write('<div class="demographics-left">');
    const patientName = document.getElementById('patientName').value;
    const nhsNumber = document.getElementById('nhsNumber').value;
    const dob = new Date(document.getElementById('dob').value).toLocaleDateString('en-GB');
    printWindow.document.write(`<p><strong>Patient Name:</strong> ${patientName}</p>`);
    printWindow.document.write(`<p><strong>NHS Number:</strong> ${nhsNumber}</p>`);
    printWindow.document.write(`<p><strong>Date of Birth:</strong> ${dob}</p>`);
    printWindow.document.write('</div>');
    
    // Right column - Clinical details
    printWindow.document.write('<div class="demographics-right">');
    const weight = document.getElementById('weight').value;
    const gestationWeeks = document.getElementById('gestationWeeks').value;
    const gestationDays = document.getElementById('gestationDays').value;
    printWindow.document.write(`<p><strong>Birth Weight:</strong> ${weight} kg</p>`);
    printWindow.document.write(`<p><strong>Gestation:</strong> ${gestationWeeks}+${gestationDays}</p>`);
    printWindow.document.write('</div>');
    printWindow.document.write('</div>');

    // Add milestones table
    const outputDiv = document.getElementById('output');
    printWindow.document.write(outputDiv.innerHTML);

    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.print();
}

// Initialize app with better error handling
async function initializeApp() {
    try {
        // Initialize IndexedDB first
        await initDB();
        console.log('Database initialized');
        
        // Then load settings
        await loadMilestoneSettings();
        console.log('Settings loaded');
        
        // Hide splash screen only after everything is initialized
        const splashScreen = document.getElementById('splashScreen');
        splashScreen.classList.add('hidden');
        setTimeout(() => {
            splashScreen.style.display = 'none';
            document.getElementById('loginScreen').style.display = 'flex';
        }, 300);
    } catch (error) {
        console.error('Failed to initialize app:', error);
        alert('Error initializing app. Please refresh the page and try again.');
        const splashScreen = document.getElementById('splashScreen');
        splashScreen.classList.add('hidden');
        splashScreen.style.display = 'none';
        document.getElementById('loginScreen').style.display = 'flex';
    }
}

// Start initialization when page loads
window.addEventListener('load', () => {
    initializeApp().catch(error => {
        console.error('Error during initialization:', error);
    });
    
    // Setup offline status detection
    const offlineIndicator = document.getElementById('offlineIndicator');
    const cachedDataNotice = document.getElementById('cachedDataNotice');
    
    function updateOnlineStatus() {
        if (navigator.onLine) {
            offlineIndicator.style.display = 'none';
            cachedDataNotice.style.display = 'none';
            syncOfflineData();
        } else {
            offlineIndicator.style.display = 'block';
            cachedDataNotice.style.display = 'block';
        }
    }

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();
});

// Sync any offline data when back online
async function syncOfflineData() {
    if (!navigator.onLine) return;

    try {
        const calculations = await getCalculations();
        const pendingSync = calculations.filter(calc => calc.needsSync);
        
        if (pendingSync.length > 0) {
            // Here you could implement server sync when needed
            console.log('Syncing offline calculations:', pendingSync.length);
            
            // Mark as synced in IndexedDB
            const transaction = db.transaction(['calculations'], 'readwrite');
            const store = transaction.objectStore('calculations');
            
            for (const calc of pendingSync) {
                calc.needsSync = false;
                await store.put(calc);
            }
        }
    } catch (error) {
        console.error('Error syncing offline data:', error);
    }
}