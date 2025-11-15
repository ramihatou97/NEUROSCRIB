/**
 * Clinical Scales Module for NeuroScribe V11
 * Extracted from V10.2.4 monolith
 *
 * Comprehensive collection of neurosurgical assessment scales
 * Includes: mJOA, Nurick, NDI, ODI, VAS Pain, GCS
 */

const ClinicalScalesDatabase = {

    // ============================================================
    // SPINE SCALES (PRIORITY IMPLEMENTATION)
    // ============================================================

    'mjoa': {
        id: 'mjoa',
        name: 'Modified Japanese Orthopedic Association (mJOA) Score',
        shortName: 'mJOA',
        category: 'spine',
        pathologies: ['spine-degenerative'],
        description: 'Assessment scale for cervical myelopathy severity. Evaluates motor and sensory function in upper/lower extremities and bladder function.',
        questions: [
            {
                id: 'motor_upper',
                section: 'Motor Function',
                text: 'Motor dysfunction of the upper extremity',
                options: [
                    {value: 0, label: 'Unable to feed oneself', description: 'Severe impairment - cannot use utensils'},
                    {value: 1, label: 'Unable to handle chopsticks but able to eat with spoon', description: 'Significant impairment'},
                    {value: 2, label: 'Handles chopsticks with difficulty', description: 'Moderate impairment'},
                    {value: 3, label: 'Handles chopsticks with slight difficulty', description: 'Mild impairment'},
                    {value: 4, label: 'Normal', description: 'No impairment'}
                ],
                value: null,
                keywords: ['hand function', 'fine motor', 'buttons', 'writing', 'feeding', 'utensils', 'chopsticks', 'dropping objects']
            },
            {
                id: 'motor_lower',
                section: 'Motor Function',
                text: 'Motor dysfunction of the lower extremity',
                options: [
                    {value: 0, label: 'Unable to walk', description: 'Complete loss of ambulation'},
                    {value: 1, label: 'Needs cane or aid on flat ground', description: 'Significant assistance required'},
                    {value: 2, label: 'Needs cane or aid on stairs', description: 'Limited assistance'},
                    {value: 3, label: 'Lacks smooth reciprocation or speed', description: 'Mild gait abnormality'},
                    {value: 4, label: 'Normal', description: 'No impairment'}
                ],
                value: null,
                keywords: ['walking', 'gait', 'stairs', 'climbing', 'balance', 'cane', 'walker', 'ambulation', 'legs']
            },
            {
                id: 'sensory_upper',
                section: 'Sensory Function',
                text: 'Sensory dysfunction of the upper extremity',
                options: [
                    {value: 0, label: 'Severe sensory loss or pain', description: 'Marked impairment'},
                    {value: 1, label: 'Mild sensory loss or pain', description: 'Slight impairment'},
                    {value: 2, label: 'Normal', description: 'No impairment'}
                ],
                value: null,
                keywords: ['numbness', 'tingling', 'sensation', 'arms', 'hands', 'fingers', 'upper extremity', 'paresthesia']
            },
            {
                id: 'sensory_lower',
                section: 'Sensory Function',
                text: 'Sensory dysfunction of the lower extremity',
                options: [
                    {value: 0, label: 'Severe sensory loss or pain', description: 'Marked impairment'},
                    {value: 1, label: 'Mild sensory loss or pain', description: 'Slight impairment'},
                    {value: 2, label: 'Normal', description: 'No impairment'}
                ],
                value: null,
                keywords: ['numbness', 'tingling', 'sensation', 'legs', 'feet', 'toes', 'lower extremity', 'paresthesia']
            },
            {
                id: 'sensory_trunk',
                section: 'Sensory Function',
                text: 'Sensory dysfunction of the trunk',
                options: [
                    {value: 0, label: 'Severe sensory loss or pain', description: 'Marked impairment'},
                    {value: 1, label: 'Mild sensory loss or pain', description: 'Slight impairment'},
                    {value: 2, label: 'Normal', description: 'No impairment'}
                ],
                value: null,
                keywords: ['trunk', 'chest', 'abdomen', 'torso', 'body', 'sensory level']
            },
            {
                id: 'bladder',
                section: 'Bladder Function',
                text: 'Sphincter dysfunction (Bladder function)',
                options: [
                    {value: 0, label: 'Urinary retention and/or incontinence', description: 'Complete dysfunction'},
                    {value: 1, label: 'Sense of retention and/or incomplete continence', description: 'Moderate dysfunction'},
                    {value: 2, label: 'Urinary frequency and/or hesitation', description: 'Mild dysfunction'},
                    {value: 3, label: 'Normal', description: 'No impairment'}
                ],
                value: null,
                keywords: ['bladder', 'urinary', 'incontinence', 'retention', 'frequency', 'urgency', 'hesitation', 'catheter']
            }
        ],
        scoring: function(responses) {
            let total = 0;
            let answered = 0;
            for (const q of this.questions) {
                if (q.value !== null && q.value !== undefined) {
                    total += q.value;
                    answered++;
                }
            }
            return {
                total: total,
                max: this.maxScore,
                answered: answered,
                totalQuestions: this.questions.length,
                percentage: answered > 0 ? Math.round((answered / this.questions.length) * 100) : 0
            };
        },
        interpretation: function(score) {
            if (score >= 15) {
                return {
                    severity: 'Mild Myelopathy',
                    color: '#10b981',
                    description: 'Minimal functional impairment',
                    recommendation: 'Consider conservative management, close monitoring'
                };
            } else if (score >= 12) {
                return {
                    severity: 'Moderate Myelopathy',
                    color: '#f59e0b',
                    description: 'Moderate functional limitations',
                    recommendation: 'Consider surgical intervention if progressive or conservative treatment fails'
                };
            } else {
                return {
                    severity: 'Severe Myelopathy',
                    color: '#dc2626',
                    description: 'Significant functional impairment',
                    recommendation: 'Surgical intervention strongly recommended'
                };
            }
        },
        minScore: 0,
        maxScore: 17,
        ranges: [
            {min: 0, max: 11, severity: 'Severe', color: '#dc2626'},
            {min: 12, max: 14, severity: 'Moderate', color: '#f59e0b'},
            {min: 15, max: 17, severity: 'Mild', color: '#10b981'}
        ],
        evidenceLevel: 'Level II - Validated outcome measure',
        references: [
            'Benzel EC, et al. Cervical laminectomy and dentate ligament section for cervical spondylotic myelopathy. J Spinal Disord. 1991;4:286-295.',
            'Yonenobu K, et al. Interobserver and intraobserver reliability of the Japanese Orthopaedic Association scoring system. Spine. 2001;26:1890-1894.'
        ]
    },

    'nurick': {
        id: 'nurick',
        name: 'Nurick Classification/Grade',
        shortName: 'Nurick',
        category: 'spine',
        pathologies: ['spine-degenerative'],
        description: 'Classification system for cervical myelopathy based on walking ability and gait disturbance.',
        questions: [
            {
                id: 'grade',
                section: 'Functional Status',
                text: 'Cervical myelopathy grade based on walking ability',
                options: [
                    {value: 0, label: 'Grade 0: No signs or symptoms of cord involvement', description: 'Root signs only'},
                    {value: 1, label: 'Grade 1: Signs of cord involvement but no difficulty walking', description: 'Myelopathy present, ambulation normal'},
                    {value: 2, label: 'Grade 2: Slight difficulty walking, able to work', description: 'Mild gait impairment, employment maintained'},
                    {value: 3, label: 'Grade 3: Difficulty walking prevents work or full-time employment', description: 'Moderate impairment'},
                    {value: 4, label: 'Grade 4: Able to walk only with assistance', description: 'Severe impairment, requires aid'},
                    {value: 5, label: 'Grade 5: Wheelchair bound or bedridden', description: 'Non-ambulatory'}
                ],
                value: null,
                keywords: ['walking', 'gait', 'wheelchair', 'assistance', 'cane', 'walker', 'bedridden', 'employment', 'work']
            }
        ],
        scoring: function(responses) {
            const grade = this.questions[0].value;
            return {
                total: grade !== null ? grade : null,
                max: 5,
                answered: grade !== null ? 1 : 0,
                totalQuestions: 1,
                percentage: grade !== null ? 100 : 0
            };
        },
        interpretation: function(grade) {
            const interpretations = {
                0: {severity: 'Grade 0 - No Myelopathy', color: '#10b981', description: 'Radiculopathy only', recommendation: 'Conservative management typically appropriate'},
                1: {severity: 'Grade 1 - Very Mild', color: '#10b981', description: 'Signs present, no functional limitation', recommendation: 'Monitor, consider intervention if progressive'},
                2: {severity: 'Grade 2 - Mild', color: '#84cc16', description: 'Slight gait difficulty, maintains employment', recommendation: 'Consider surgical intervention, discuss risks/benefits'},
                3: {severity: 'Grade 3 - Moderate', color: '#f59e0b', description: 'Cannot work due to gait impairment', recommendation: 'Surgical intervention recommended'},
                4: {severity: 'Grade 4 - Severe', color: '#ef4444', description: 'Requires assistive device', recommendation: 'Surgical intervention strongly recommended'},
                5: {severity: 'Grade 5 - Very Severe', color: '#dc2626', description: 'Non-ambulatory', recommendation: 'Surgery indicated, but outcomes may be limited'}
            };
            return interpretations[grade] || {severity: 'Unknown', color: '#6b7280', description: 'Grade not assessed', recommendation: 'Complete assessment'};
        },
        minScore: 0,
        maxScore: 5,
        ranges: [
            {min: 0, max: 1, severity: 'No/Minimal', color: '#10b981'},
            {min: 2, max: 3, severity: 'Mild-Moderate', color: '#f59e0b'},
            {min: 4, max: 5, severity: 'Severe', color: '#dc2626'}
        ],
        evidenceLevel: 'Level II - Widely accepted classification',
        references: [
            'Nurick S. The pathogenesis of the spinal cord disorder associated with cervical spondylosis. Brain. 1972;95:87-100.'
        ]
    },

    'ndi': {
        id: 'ndi',
        name: 'Neck Disability Index (NDI)',
        shortName: 'NDI',
        category: 'spine',
        pathologies: ['spine-degenerative', 'spine-trauma'],
        description: 'Patient-reported outcome measure for neck pain and disability. 10 sections, each scored 0-5.',
        questions: [
            {
                id: 'pain_intensity',
                section: 'Section 1',
                text: 'Pain Intensity',
                options: [
                    {value: 0, label: 'I have no pain at the moment'},
                    {value: 1, label: 'The pain is very mild at the moment'},
                    {value: 2, label: 'The pain is moderate at the moment'},
                    {value: 3, label: 'The pain is fairly severe at the moment'},
                    {value: 4, label: 'The pain is very severe at the moment'},
                    {value: 5, label: 'The pain is the worst imaginable at the moment'}
                ],
                value: null,
                keywords: ['neck pain', 'pain intensity', 'pain level', 'how much pain']
            },
            {
                id: 'personal_care',
                section: 'Section 2',
                text: 'Personal Care (washing, dressing, etc.)',
                options: [
                    {value: 0, label: 'I can look after myself normally without causing extra pain'},
                    {value: 1, label: 'I can look after myself normally but it causes extra pain'},
                    {value: 2, label: 'It is painful to look after myself and I am slow and careful'},
                    {value: 3, label: 'I need some help but manage most of my personal care'},
                    {value: 4, label: 'I need help every day in most aspects of self care'},
                    {value: 5, label: 'I do not get dressed, wash with difficulty, and stay in bed'}
                ],
                value: null,
                keywords: ['dressing', 'washing', 'bathing', 'grooming', 'personal care', 'self care']
            },
            {
                id: 'lifting',
                section: 'Section 3',
                text: 'Lifting',
                options: [
                    {value: 0, label: 'I can lift heavy weights without extra pain'},
                    {value: 1, label: 'I can lift heavy weights but it gives extra pain'},
                    {value: 2, label: 'Pain prevents me from lifting heavy weights off the floor, but I can if items are conveniently positioned'},
                    {value: 3, label: 'Pain prevents me from lifting heavy weights, but I can manage light to medium weights'},
                    {value: 4, label: 'I can lift only very light weights'},
                    {value: 5, label: 'I cannot lift or carry anything at all'}
                ],
                value: null,
                keywords: ['lifting', 'carrying', 'heavy objects', 'weights']
            },
            {
                id: 'reading',
                section: 'Section 4',
                text: 'Reading',
                options: [
                    {value: 0, label: 'I can read as much as I want with no pain in my neck'},
                    {value: 1, label: 'I can read as much as I want with slight pain in my neck'},
                    {value: 2, label: 'I can read as much as I want with moderate pain in my neck'},
                    {value: 3, label: 'I cannot read as much as I want because of moderate pain in my neck'},
                    {value: 4, label: 'I can hardly read at all because of severe pain in my neck'},
                    {value: 5, label: 'I cannot read at all'}
                ],
                value: null,
                keywords: ['reading', 'looking down', 'neck flexion', 'computer work', 'phone use']
            },
            {
                id: 'headaches',
                section: 'Section 5',
                text: 'Headaches',
                options: [
                    {value: 0, label: 'I have no headaches at all'},
                    {value: 1, label: 'I have slight headaches which come infrequently'},
                    {value: 2, label: 'I have moderate headaches which come infrequently'},
                    {value: 3, label: 'I have moderate headaches which come frequently'},
                    {value: 4, label: 'I have severe headaches which come frequently'},
                    {value: 5, label: 'I have headaches almost all the time'}
                ],
                value: null,
                keywords: ['headache', 'head pain', 'cervicogenic headache', 'occipital pain']
            },
            {
                id: 'concentration',
                section: 'Section 6',
                text: 'Concentration',
                options: [
                    {value: 0, label: 'I can concentrate fully when I want with no difficulty'},
                    {value: 1, label: 'I can concentrate fully when I want with slight difficulty'},
                    {value: 2, label: 'I have a fair degree of difficulty concentrating when I want'},
                    {value: 3, label: 'I have a lot of difficulty concentrating when I want'},
                    {value: 4, label: 'I have a great deal of difficulty concentrating when I want'},
                    {value: 5, label: 'I cannot concentrate at all'}
                ],
                value: null,
                keywords: ['concentration', 'focus', 'attention', 'mental clarity', 'cognitive']
            },
            {
                id: 'work',
                section: 'Section 7',
                text: 'Work',
                options: [
                    {value: 0, label: 'I can do as much work as I want'},
                    {value: 1, label: 'I can only do my usual work but no more'},
                    {value: 2, label: 'I can do most of my usual work but no more'},
                    {value: 3, label: 'I cannot do my usual work'},
                    {value: 4, label: 'I can hardly do any work at all'},
                    {value: 5, label: 'I cannot do any work at all'}
                ],
                value: null,
                keywords: ['work', 'job', 'employment', 'occupation', 'working']
            },
            {
                id: 'driving',
                section: 'Section 8',
                text: 'Driving',
                options: [
                    {value: 0, label: 'I can drive my car without any neck pain'},
                    {value: 1, label: 'I can drive my car as long as I want with slight pain in my neck'},
                    {value: 2, label: 'I can drive my car as long as I want with moderate pain in my neck'},
                    {value: 3, label: 'I cannot drive my car as long as I want because of moderate pain in my neck'},
                    {value: 4, label: 'I can hardly drive at all because of severe pain in my neck'},
                    {value: 5, label: 'I cannot drive my car at all'}
                ],
                value: null,
                keywords: ['driving', 'car', 'vehicle', 'turning head', 'looking over shoulder']
            },
            {
                id: 'sleeping',
                section: 'Section 9',
                text: 'Sleeping',
                options: [
                    {value: 0, label: 'I have no trouble sleeping'},
                    {value: 1, label: 'My sleep is slightly disturbed (less than 1 hour sleepless)'},
                    {value: 2, label: 'My sleep is mildly disturbed (1-2 hours sleepless)'},
                    {value: 3, label: 'My sleep is moderately disturbed (2-3 hours sleepless)'},
                    {value: 4, label: 'My sleep is greatly disturbed (3-5 hours sleepless)'},
                    {value: 5, label: 'My sleep is completely disturbed (5-7 hours sleepless)'}
                ],
                value: null,
                keywords: ['sleep', 'sleeping', 'night pain', 'insomnia', 'rest']
            },
            {
                id: 'recreation',
                section: 'Section 10',
                text: 'Recreation',
                options: [
                    {value: 0, label: 'I am able to engage in all recreational activities with no neck pain'},
                    {value: 1, label: 'I am able to engage in all recreational activities with some pain in my neck'},
                    {value: 2, label: 'I am able to engage in most but not all recreational activities because of pain in my neck'},
                    {value: 3, label: 'I am able to engage in a few recreational activities because of pain in my neck'},
                    {value: 4, label: 'I can hardly do any recreational activities because of pain in my neck'},
                    {value: 5, label: 'I cannot do any recreational activities at all'}
                ],
                value: null,
                keywords: ['recreation', 'hobbies', 'activities', 'sports', 'exercise', 'leisure']
            }
        ],
        scoring: function(responses) {
            let total = 0;
            let answered = 0;
            for (const q of this.questions) {
                if (q.value !== null && q.value !== undefined) {
                    total += q.value;
                    answered++;
                }
            }
            // NDI is reported as percentage: (total score / max possible score) × 100
            const percentage = answered > 0 ? Math.round((total / (answered * 5)) * 100) : 0;
            return {
                total: total,
                max: this.maxScore,
                percentage: percentage,
                answered: answered,
                totalQuestions: this.questions.length,
                completionPercentage: Math.round((answered / this.questions.length) * 100)
            };
        },
        interpretation: function(percentage) {
            if (percentage <= 8) {
                return {
                    severity: 'No Disability',
                    color: '#10b981',
                    description: 'No significant neck-related functional impairment',
                    recommendation: 'Continue current management, reassess if symptoms change'
                };
            } else if (percentage <= 28) {
                return {
                    severity: 'Mild Disability',
                    color: '#84cc16',
                    description: 'Mild neck-related functional limitations',
                    recommendation: 'Conservative management: PT, medications, activity modification'
                };
            } else if (percentage <= 48) {
                return {
                    severity: 'Moderate Disability',
                    color: '#f59e0b',
                    description: 'Moderate functional limitations affecting daily activities',
                    recommendation: 'Consider advanced imaging, interventional options if conservative treatment fails'
                };
            } else if (percentage <= 68) {
                return {
                    severity: 'Severe Disability',
                    color: '#ef4444',
                    description: 'Severe functional impairment',
                    recommendation: 'Comprehensive evaluation, consider surgical consultation'
                };
            } else {
                return {
                    severity: 'Complete Disability',
                    color: '#dc2626',
                    description: 'Complete or near-complete disability',
                    recommendation: 'Urgent evaluation, multidisciplinary approach'
                };
            }
        },
        minScore: 0,
        maxScore: 50,
        ranges: [
            {min: 0, max: 8, severity: 'No Disability', color: '#10b981'},
            {min: 9, max: 28, severity: 'Mild', color: '#84cc16'},
            {min: 29, max: 48, severity: 'Moderate', color: '#f59e0b'},
            {min: 49, max: 68, severity: 'Severe', color: '#ef4444'},
            {min: 69, max: 100, severity: 'Complete', color: '#dc2626'}
        ],
        evidenceLevel: 'Level I - Validated, widely used outcome measure',
        references: [
            'Vernon H, Mior S. The Neck Disability Index: a study of reliability and validity. J Manipulative Physiol Ther. 1991;14:409-415.',
            'MacDermid JC, et al. Measurement properties of the neck disability index. J Orthop Sports Phys Ther. 2009;39:400-417.'
        ]
    },

    'odi': {
        id: 'odi',
        name: 'Oswestry Disability Index (ODI)',
        shortName: 'ODI',
        category: 'spine',
        pathologies: ['spine-degenerative', 'spine-trauma'],
        description: 'Patient-reported outcome measure for lower back pain and disability. 10 sections, each scored 0-5.',
        questions: [
            {
                id: 'pain_intensity',
                section: 'Section 1',
                text: 'Pain Intensity',
                options: [
                    {value: 0, label: 'I have no pain at the moment'},
                    {value: 1, label: 'The pain is very mild at the moment'},
                    {value: 2, label: 'The pain is moderate at the moment'},
                    {value: 3, label: 'The pain is fairly severe at the moment'},
                    {value: 4, label: 'The pain is very severe at the moment'},
                    {value: 5, label: 'The pain is the worst imaginable at the moment'}
                ],
                value: null,
                keywords: ['back pain', 'low back pain', 'pain intensity', 'pain level']
            },
            {
                id: 'personal_care',
                section: 'Section 2',
                text: 'Personal Care (washing, dressing, etc.)',
                options: [
                    {value: 0, label: 'I can look after myself normally without causing extra pain'},
                    {value: 1, label: 'I can look after myself normally but it causes extra pain'},
                    {value: 2, label: 'It is painful to look after myself and I am slow and careful'},
                    {value: 3, label: 'I need some help but manage most of my personal care'},
                    {value: 4, label: 'I need help every day in most aspects of self care'},
                    {value: 5, label: 'I do not get dressed, I wash with difficulty and stay in bed'}
                ],
                value: null,
                keywords: ['dressing', 'washing', 'bathing', 'grooming', 'personal care']
            },
            {
                id: 'lifting',
                section: 'Section 3',
                text: 'Lifting',
                options: [
                    {value: 0, label: 'I can lift heavy weights without extra pain'},
                    {value: 1, label: 'I can lift heavy weights but it gives extra pain'},
                    {value: 2, label: 'Pain prevents me lifting heavy weights off the floor, but I can if they are conveniently positioned'},
                    {value: 3, label: 'Pain prevents me from lifting heavy weights but I can manage light to medium weights'},
                    {value: 4, label: 'I can only lift very light weights'},
                    {value: 5, label: 'I cannot lift or carry anything'}
                ],
                value: null,
                keywords: ['lifting', 'carrying', 'heavy objects', 'weights']
            },
            {
                id: 'walking',
                section: 'Section 4',
                text: 'Walking',
                options: [
                    {value: 0, label: 'Pain does not prevent me walking any distance'},
                    {value: 1, label: 'Pain prevents me from walking more than 1 mile'},
                    {value: 2, label: 'Pain prevents me from walking more than 1/2 mile'},
                    {value: 3, label: 'Pain prevents me from walking more than 100 yards'},
                    {value: 4, label: 'I can only walk using a stick or crutches'},
                    {value: 5, label: 'I am in bed most of the time'}
                ],
                value: null,
                keywords: ['walking', 'ambulation', 'distance', 'mobility', 'gait']
            },
            {
                id: 'sitting',
                section: 'Section 5',
                text: 'Sitting',
                options: [
                    {value: 0, label: 'I can sit in any chair as long as I like'},
                    {value: 1, label: 'I can only sit in my favorite chair as long as I like'},
                    {value: 2, label: 'Pain prevents me sitting more than one hour'},
                    {value: 3, label: 'Pain prevents me from sitting more than 30 minutes'},
                    {value: 4, label: 'Pain prevents me from sitting more than 10 minutes'},
                    {value: 5, label: 'Pain prevents me from sitting at all'}
                ],
                value: null,
                keywords: ['sitting', 'prolonged sitting', 'desk work', 'chair']
            },
            {
                id: 'standing',
                section: 'Section 6',
                text: 'Standing',
                options: [
                    {value: 0, label: 'I can stand as long as I want without extra pain'},
                    {value: 1, label: 'I can stand as long as I want but it gives me extra pain'},
                    {value: 2, label: 'Pain prevents me from standing for more than 1 hour'},
                    {value: 3, label: 'Pain prevents me from standing for more than 30 minutes'},
                    {value: 4, label: 'Pain prevents me from standing for more than 10 minutes'},
                    {value: 5, label: 'Pain prevents me from standing at all'}
                ],
                value: null,
                keywords: ['standing', 'prolonged standing', 'upright posture']
            },
            {
                id: 'sleeping',
                section: 'Section 7',
                text: 'Sleeping',
                options: [
                    {value: 0, label: 'My sleep is never disturbed by pain'},
                    {value: 1, label: 'My sleep is occasionally disturbed by pain'},
                    {value: 2, label: 'Because of pain I have less than 6 hours sleep'},
                    {value: 3, label: 'Because of pain I have less than 4 hours sleep'},
                    {value: 4, label: 'Because of pain I have less than 2 hours sleep'},
                    {value: 5, label: 'Pain prevents me from sleeping at all'}
                ],
                value: null,
                keywords: ['sleep', 'sleeping', 'night pain', 'insomnia', 'rest']
            },
            {
                id: 'sex_life',
                section: 'Section 8',
                text: 'Sex Life (if applicable)',
                options: [
                    {value: 0, label: 'My sex life is normal and causes no extra pain'},
                    {value: 1, label: 'My sex life is normal but causes some extra pain'},
                    {value: 2, label: 'My sex life is nearly normal but is very painful'},
                    {value: 3, label: 'My sex life is severely restricted by pain'},
                    {value: 4, label: 'My sex life is nearly absent because of pain'},
                    {value: 5, label: 'Pain prevents any sex life at all'}
                ],
                value: null,
                keywords: ['sexual function', 'intimacy', 'sex life']
            },
            {
                id: 'social_life',
                section: 'Section 9',
                text: 'Social Life',
                options: [
                    {value: 0, label: 'My social life is normal and gives me no extra pain'},
                    {value: 1, label: 'My social life is normal but increases the degree of pain'},
                    {value: 2, label: 'Pain has no significant effect on my social life apart from limiting my more energetic interests'},
                    {value: 3, label: 'Pain has restricted my social life and I do not go out as often'},
                    {value: 4, label: 'Pain has restricted my social life to my home'},
                    {value: 5, label: 'I have no social life because of pain'}
                ],
                value: null,
                keywords: ['social life', 'socializing', 'going out', 'activities', 'friends']
            },
            {
                id: 'traveling',
                section: 'Section 10',
                text: 'Travelling',
                options: [
                    {value: 0, label: 'I can travel anywhere without pain'},
                    {value: 1, label: 'I can travel anywhere but it gives me extra pain'},
                    {value: 2, label: 'Pain is bad but I manage journeys over two hours'},
                    {value: 3, label: 'Pain restricts me to journeys of less than one hour'},
                    {value: 4, label: 'Pain restricts me to short necessary journeys under 30 minutes'},
                    {value: 5, label: 'Pain prevents me from travelling except to receive treatment'}
                ],
                value: null,
                keywords: ['traveling', 'driving', 'car rides', 'trips', 'journeys']
            }
        ],
        scoring: function(responses) {
            let total = 0;
            let answered = 0;
            for (const q of this.questions) {
                if (q.value !== null && q.value !== undefined) {
                    total += q.value;
                    answered++;
                }
            }
            // ODI is reported as percentage: (total score / max possible score) × 100
            const percentage = answered > 0 ? Math.round((total / (answered * 5)) * 100) : 0;
            return {
                total: total,
                max: this.maxScore,
                percentage: percentage,
                answered: answered,
                totalQuestions: this.questions.length,
                completionPercentage: Math.round((answered / this.questions.length) * 100)
            };
        },
        interpretation: function(percentage) {
            if (percentage <= 20) {
                return {
                    severity: 'Minimal Disability',
                    color: '#10b981',
                    description: 'Can cope with most activities of daily living',
                    recommendation: 'Continue activity, no treatment indicated'
                };
            } else if (percentage <= 40) {
                return {
                    severity: 'Moderate Disability',
                    color: '#84cc16',
                    description: 'Experiencing more pain, difficulty with sitting, lifting, standing',
                    recommendation: 'Conservative treatment: PT, pain management'
                };
            } else if (percentage <= 60) {
                return {
                    severity: 'Severe Disability',
                    color: '#f59e0b',
                    description: 'Pain remains main problem, interfering with all aspects of life',
                    recommendation: 'Detailed investigation, may require advanced treatment'
                };
            } else if (percentage <= 80) {
                return {
                    severity: 'Crippled',
                    color: '#ef4444',
                    description: 'Back pain impinging on all aspects of life',
                    recommendation: 'Active intervention required, consider surgical consultation'
                };
            } else {
                return {
                    severity: 'Bed-bound or Exaggerating',
                    color: '#dc2626',
                    description: 'Confined to bed or exaggerating symptoms',
                    recommendation: 'Careful reassessment, multidisciplinary evaluation'
                };
            }
        },
        minScore: 0,
        maxScore: 50,
        ranges: [
            {min: 0, max: 20, severity: 'Minimal', color: '#10b981'},
            {min: 21, max: 40, severity: 'Moderate', color: '#84cc16'},
            {min: 41, max: 60, severity: 'Severe', color: '#f59e0b'},
            {min: 61, max: 80, severity: 'Crippled', color: '#ef4444'},
            {min: 81, max: 100, severity: 'Bed-bound', color: '#dc2626'}
        ],
        evidenceLevel: 'Level I - Gold standard for low back disability',
        references: [
            'Fairbank JC, Pynsent PB. The Oswestry Disability Index. Spine. 2000;25:2940-2952.',
            'Ostelo RW, et al. Interpreting change scores for pain and functional status in low back pain. Spine. 2008;33:90-94.'
        ]
    },

    'vas_pain': {
        id: 'vas_pain',
        name: 'Visual Analog Scale (VAS) for Pain',
        shortName: 'VAS Pain',
        category: 'pain',
        pathologies: ['spine-degenerative', 'spine-trauma', 'brain-tumor', 'vascular', 'functional'],
        description: 'Simple pain intensity rating scale from 0-10. 0 = no pain, 10 = worst pain imaginable.',
        questions: [
            {
                id: 'current_pain',
                section: 'Pain Assessment',
                text: 'Current Pain Level (0-10)',
                type: 'slider',
                options: [], // Slider from 0-10
                value: null,
                keywords: ['pain', 'pain level', 'how much pain', 'pain intensity', 'hurts']
            },
            {
                id: 'worst_pain',
                section: 'Pain Assessment',
                text: 'Worst Pain in Last 24 Hours (0-10)',
                type: 'slider',
                options: [],
                value: null,
                keywords: ['worst pain', 'maximum pain', 'peak pain']
            },
            {
                id: 'average_pain',
                section: 'Pain Assessment',
                text: 'Average Pain Level (0-10)',
                type: 'slider',
                options: [],
                value: null,
                keywords: ['average pain', 'typical pain', 'usual pain']
            }
        ],
        scoring: function(responses) {
            const current = this.questions[0].value;
            const worst = this.questions[1].value;
            const average = this.questions[2].value;
            let answered = 0;
            let total = 0;

            if (current !== null) { answered++; total += current; }
            if (worst !== null) { answered++; total += worst; }
            if (average !== null) { answered++; total += average; }

            const avgScore = answered > 0 ? Math.round(total / answered) : null;

            return {
                current: current,
                worst: worst,
                average: average,
                overallAverage: avgScore,
                answered: answered,
                totalQuestions: this.questions.length,
                percentage: Math.round((answered / this.questions.length) * 100)
            };
        },
        interpretation: function(score) {
            if (score === null || score === undefined) {
                return {severity: 'Not Assessed', color: '#6b7280', description: 'Pain not evaluated', recommendation: 'Complete pain assessment'};
            }
            if (score <= 2) {
                return {severity: 'Mild Pain', color: '#10b981', description: 'Minimal pain, no/minimal functional impact', recommendation: 'No intervention or simple analgesics prn'};
            } else if (score <= 5) {
                return {severity: 'Moderate Pain', color: '#f59e0b', description: 'Noticeable pain affecting some activities', recommendation: 'Regular analgesics, consider PT or other modalities'};
            } else if (score <= 7) {
                return {severity: 'Severe Pain', color: '#ef4444', description: 'Significant pain interfering with daily function', recommendation: 'Multimodal pain management, consider advanced therapies'};
            } else {
                return {severity: 'Very Severe Pain', color: '#dc2626', description: 'Worst possible pain, unable to function', recommendation: 'Urgent pain management, evaluate for acute intervention'};
            }
        },
        minScore: 0,
        maxScore: 10,
        ranges: [
            {min: 0, max: 2, severity: 'Mild', color: '#10b981'},
            {min: 3, max: 5, severity: 'Moderate', color: '#f59e0b'},
            {min: 6, max: 7, severity: 'Severe', color: '#ef4444'},
            {min: 8, max: 10, severity: 'Very Severe', color: '#dc2626'}
        ],
        evidenceLevel: 'Level I - Universally accepted pain measure',
        references: [
            'Hawker GA, et al. Measures of adult pain. Arthritis Care Res. 2011;63(S11):S240-252.'
        ]
    },

    // ============================================================
    // FUNCTIONAL SCALES
    // ============================================================

    'gcs': {
        id: 'gcs',
        name: 'Glasgow Coma Scale (GCS)',
        shortName: 'GCS',
        category: 'functional',
        pathologies: ['spine-trauma', 'brain-tumor', 'vascular', 'hydrocephalus'],
        description: 'Neurological scale to assess consciousness level. Evaluates eye, verbal, and motor responses.',
        questions: [
            {
                id: 'eye',
                section: 'Eye Opening Response',
                text: 'Eye Opening',
                options: [
                    {value: 4, label: 'Spontaneous - Opens eyes spontaneously'},
                    {value: 3, label: 'To verbal command - Opens eyes to verbal stimulation'},
                    {value: 2, label: 'To pain - Opens eyes to painful stimulus'},
                    {value: 1, label: 'No response - Does not open eyes'}
                ],
                value: null,
                keywords: ['eye opening', 'opens eyes', 'spontaneous', 'to voice', 'to pain']
            },
            {
                id: 'verbal',
                section: 'Verbal Response',
                text: 'Verbal Response',
                options: [
                    {value: 5, label: 'Oriented - Oriented to person, place, time'},
                    {value: 4, label: 'Confused - Disoriented conversation'},
                    {value: 3, label: 'Inappropriate words - Intelligible but inappropriate'},
                    {value: 2, label: 'Incomprehensible sounds - Moaning/groaning only'},
                    {value: 1, label: 'No response - No verbal response'}
                ],
                value: null,
                keywords: ['speaking', 'talking', 'oriented', 'confused', 'verbal', 'speech', 'alert']
            },
            {
                id: 'motor',
                section: 'Motor Response',
                text: 'Best Motor Response',
                options: [
                    {value: 6, label: 'Obeys commands - Follows simple commands'},
                    {value: 5, label: 'Localizes pain - Purposeful movement to painful stimulus'},
                    {value: 4, label: 'Withdraws from pain - Pulls limb away from pain'},
                    {value: 3, label: 'Flexion to pain - Abnormal flexion (decorticate)'},
                    {value: 2, label: 'Extension to pain - Abnormal extension (decerebrate)'},
                    {value: 1, label: 'No response - No motor response'}
                ],
                value: null,
                keywords: ['motor', 'movement', 'follows commands', 'localizes', 'withdraws', 'flexion', 'extension', 'posturing']
            }
        ],
        scoring: function(responses) {
            let total = 0;
            let answered = 0;
            for (const q of this.questions) {
                if (q.value !== null && q.value !== undefined) {
                    total += q.value;
                    answered++;
                }
            }
            return {
                total: total,
                eye: this.questions[0].value,
                verbal: this.questions[1].value,
                motor: this.questions[2].value,
                answered: answered,
                totalQuestions: this.questions.length,
                percentage: Math.round((answered / this.questions.length) * 100)
            };
        },
        interpretation: function(score) {
            if (score >= 14) {
                return {severity: 'Mild TBI', color: '#10b981', description: 'Minimal neurological impairment', recommendation: 'Observation, may not require admission'};
            } else if (score >= 9) {
                return {severity: 'Moderate TBI', color: '#f59e0b', description: 'Moderate neurological impairment', recommendation: 'Admission, close monitoring, CT scan'};
            } else if (score >= 3) {
                return {severity: 'Severe TBI', color: '#dc2626', description: 'Severe neurological impairment', recommendation: 'ICU admission, intubation consideration, neurosurgical consultation'};
            } else {
                return {severity: 'Unknown', color: '#6b7280', description: 'Not assessed', recommendation: 'Complete GCS assessment'};
            }
        },
        minScore: 3,
        maxScore: 15,
        ranges: [
            {min: 3, max: 8, severity: 'Severe', color: '#dc2626'},
            {min: 9, max: 13, severity: 'Moderate', color: '#f59e0b'},
            {min: 14, max: 15, severity: 'Mild', color: '#10b981'}
        ],
        evidenceLevel: 'Level I - Gold standard for consciousness assessment',
        references: [
            'Teasdale G, Jennett B. Assessment of coma and impaired consciousness. Lancet. 1974;2:81-84.'
        ]
    }

    // Additional scales to be implemented in future iterations:
    // - KPS (Karnofsky Performance Scale)
    // - mRS (Modified Rankin Scale)
    // - NIHSS (NIH Stroke Scale)
    // - ASIA (Spinal Cord Injury)
    // - Hunt-Hess (SAH grading)
    // - Fisher Scale (SAH)
    // - WFNS (SAH)
    // - Spetzler-Martin (AVM)
    // - TLICS/SLIC (Spine trauma)
    // - Frankel Grade
    // - UPDRS (Parkinson's)
    // - etc.
};

/**
 * ClinicalScales Class - V11 API Wrapper
 * Provides a clean interface for accessing clinical scales
 */
export class ClinicalScales {
    constructor() {
        this.database = ClinicalScalesDatabase;
    }

    /**
     * Get a specific scale by ID
     */
    getScale(scaleId) {
        return this.database[scaleId] || null;
    }

    /**
     * Get all available scales
     */
    getAllScales() {
        return Object.keys(this.database).map(id => this.database[id]);
    }

    /**
     * Get scales for a specific pathology
     */
    getScalesForPathology(pathology) {
        return this.getAllScales().filter(scale =>
            scale.pathologies && scale.pathologies.includes(pathology)
        );
    }

    /**
     * Get scales by category
     */
    getScalesByCategory(category) {
        return this.getAllScales().filter(scale => scale.category === category);
    }

    /**
     * Calculate score for a scale
     */
    calculateScore(scaleId, responses) {
        const scale = this.getScale(scaleId);
        if (!scale) return null;

        return scale.scoring(responses);
    }

    /**
     * Get interpretation for a score
     */
    getInterpretation(scaleId, score) {
        const scale = this.getScale(scaleId);
        if (!scale) return null;

        return scale.interpretation(score);
    }
}

// Export the database as well for backwards compatibility
export { ClinicalScalesDatabase };

// Default export
export default ClinicalScales;
