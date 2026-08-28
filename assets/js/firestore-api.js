const Api = (() => {
    const COLL_ACCOUNTS = 'accounts';
    const COLL_SECTIONS = 'section_config';
    const COLL_GROUPS = 'groups_table';
    const COLL_RATINGS = 'group_ratings';
    const COLL_CRITERIA = 'rubric_criteria';

    const GROUP_NAMES = ['GROUP 1','GROUP 2','GROUP 3','GROUP 4','GROUP 5','GROUP 6','GROUP 7','GROUP 8','GROUP 9','GROUP 10'];
    const MEMBER_FIELDS = ['member1_name','member2_name','member3_name','member4_name','member5_name','member6_name'];
    // LEGACY fallback keys — kept ONLY for backward compatibility when reading old
    // rating docs. The PRIMARY source of criteria is the `rubric_criteria` collection
    // read through getCriteria().
    const CRITERIA = ['content_accuracy','understanding_topic','organization_structure','delivery_communication','audience_engagement','visual_aids','professional_appearance','teamwork_collaboration','time_allocation','strategies'];

    // 10 default criteria seeded into `rubric_criteria` on first load (AC1).
    // Descriptions copied VERBATIM from the rubric table in index.html.
    const DEFAULT_CRITERIA = [
        { id: 'content_accuracy', name: 'Content Accuracy', desc4: 'Information is accurate, complete, and well-researched.', desc3: 'Mostly accurate with minor errors.', desc2: 'Some inaccuracies or missing information.', desc1: 'Content lacks accuracy and completeness.' },
        { id: 'understanding_topic', name: 'Understanding of Topic', desc4: 'Demonstrates excellent mastery and answers questions confidently.', desc3: 'Shows good understanding with minor difficulties.', desc2: 'Basic understanding but struggles with some concepts.', desc1: 'Limited understanding of the topic.' },
        { id: 'organization_structure', name: 'Organization & Structure', desc4: 'Presentation has a clear introduction, body, and conclusion.', desc3: 'Generally organized with minor lapses.', desc2: 'Somewhat organized but difficult to follow at times.', desc1: 'Lacks clear organization.' },
        { id: 'delivery_communication', name: 'Delivery & Communication', desc4: 'Speaks clearly, confidently, and maintains audience attention.', desc3: 'Generally clear and confident.', desc2: 'Some issues with clarity or confidence.', desc1: 'Difficult to hear or understand.' },
        { id: 'audience_engagement', name: 'Audience Engagement', desc4: 'Actively engages audience through questions, examples, or interaction.', desc3: 'Maintains audience interest most of the time.', desc2: 'Limited audience interaction.', desc1: 'Little to no audience engagement.' },
        { id: 'visual_aids', name: 'Visual Aids/Materials', desc4: 'Materials are attractive, relevant, and enhance learning.', desc3: 'Materials are useful with minor improvements needed.', desc2: 'Materials are somewhat relevant but lack effectiveness.', desc1: 'Materials are missing or ineffective.' },
        { id: 'professional_appearance', name: 'Professional Appearance', desc4: 'Attire is neat, professional, and appropriate.', desc3: 'Generally appropriate attire.', desc2: 'Somewhat inappropriate or untidy.', desc1: 'Unprofessional appearance.' },
        { id: 'teamwork_collaboration', name: 'Teamwork/Collaboration', desc4: 'All members contribute equally and work cohesively.', desc3: 'Most members participate actively.', desc2: 'Uneven participation among members.', desc1: 'Lack of teamwork and coordination.' },
        { id: 'time_allocation', name: 'Time Allocation: 30 mins', desc4: 'Ended the lessons on time.', desc3: 'Extended 5 mins on lesson discussion.', desc2: 'Extended 10 mins on discussion.', desc1: 'Extended 30 mins on discussion.' },
        { id: 'strategies', name: 'Strategies & Enjoyment', desc4: 'Highly enjoyable, creative, and energetic presentation.', desc3: 'Mostly enjoyable with some creativity.', desc2: 'Limited excitement or creativity.', desc1: 'Lacks enthusiasm and interest.' }
    ];

    // In-memory cache of live criteria (ordered by position), one per session.
    // Invalidated on save/delete/reorder.
    let criteriaCache = null;

    // Seeds the 10 default criteria into `rubric_criteria` if the collection is
    // empty. Idempotent (checks existing count > 0).
    async function seedCriteriaIfEmpty() {
        const snap = await db.collection(COLL_CRITERIA).get();
        if (snap.size > 0) return { status: 'success', seeded: false };
        const batch = db.batch();
        DEFAULT_CRITERIA.forEach((c, i) => {
            batch.set(db.collection(COLL_CRITERIA).doc('C_' + c.id), {
                id: c.id,
                name: c.name,
                desc4: c.desc4,
                desc3: c.desc3,
                desc2: c.desc2,
                desc1: c.desc1,
                position: i,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });
        await batch.commit();
        return { status: 'success', seeded: true };
    }

    // Returns the live criteria ordered by position (the single source of truth).
    async function getCriteria() {
        if (criteriaCache) return criteriaCache;
        await seedCriteriaIfEmpty();
        const snap = await db.collection(COLL_CRITERIA).orderBy('position', 'asc').get();
        criteriaCache = snap.docs.map(d => {
            const data = d.data();
            return {
                id: data.id,
                name: data.name || '',
                desc4: data.desc4 || '',
                desc3: data.desc3 || '',
                desc2: data.desc2 || '',
                desc1: data.desc1 || '',
                position: data.position || 0
            };
        });
        return criteriaCache;
    }

    function enc(v) { return encodeURIComponent(String(v == null ? '' : v)); }
    function docKey(prefix, ...parts) { return prefix + parts.map(enc).join('_'); }
    function accountDocId(username) { return docKey('A_', username); }
    function sectionDocId(instructor, section) { return docKey('S_', instructor, section); }
    function groupDocId(instructor, section, groupName) { return docKey('G_', instructor, section, groupName); }
    function ratingDocId(rater, groupName, section) { return docKey('R_', rater, groupName, section); }

    async function queryWhere(collection, conditions) {
        let ref = db.collection(collection);
        conditions.forEach(c => { if (c) ref = ref.where(c[0], c[1], c[2]); });
        const snap = await ref.get();
        return snap.docs.map(d => Object.assign({ id: d.id }, d.data()));
    }

    async function firstDoc(collection, conditions) {
        const docs = await queryWhere(collection, conditions);
        return docs.length ? docs[0] : null;
    }

    async function hashPassword(pw) {
        try {
            const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(pw)));
            return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (e) {
            let h = 5381;
            const s = String(pw);
            for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
            return 'x' + h.toString(16);
        }
    }

    async function deleteWhere(collection, conditions) {
        const docs = await queryWhere(collection, conditions);
        for (let i = 0; i < docs.length; i += 450) {
            const batch = db.batch();
            docs.slice(i, i + 450).forEach(d => batch.delete(db.collection(collection).doc(d.id)));
            await batch.commit();
        }
        return docs.length;
    }

    async function updateWhere(collection, conditions, updates) {
        const docs = await queryWhere(collection, conditions);
        for (const d of docs) {
            await db.collection(collection).doc(d.id).update(updates);
        }
        return docs.length;
    }

    async function findGroupByMember(name, section) {
        const nm = String(name || '').trim().toUpperCase();
        const conds = section ? [['section', '==', section]] : [];
        const groups = await queryWhere(COLL_GROUPS, conds);
        return groups.find(g => MEMBER_FIELDS.some(f => String(g[f] || '').trim().toUpperCase() === nm)) || null;
    }

    async function renameRaterRatings(oldName, newName, instructor) {
        const docs = await queryWhere(COLL_RATINGS, [['rater_name', '==', oldName], ['instructor', '==', instructor]]);
        for (const d of docs) {
            const newData = Object.assign({}, d);
            delete newData.id;
            newData.rater_name = newName;
            await db.collection(COLL_RATINGS).doc(ratingDocId(newName, d.group_name, d.section || '')).set(newData);
            await db.collection(COLL_RATINGS).doc(d.id).delete();
        }
    }

    function emptyGroupData(instructor, section, groupName) {
        return {
            group_name: groupName,
            instructor: instructor,
            section: section || '',
            member1_name: '',
            member2_name: '',
            member3_name: '',
            member4_name: '',
            member5_name: '',
            member6_name: '',
            is_closed: 0
        };
    }

    function pickGroupDoc(docs, instructor, section, groupName) {
        const targetId = groupDocId(instructor, section, groupName);
        const canonical = docs.find(d => d.id === targetId);
        if (canonical) return canonical;
        const sameName = docs.filter(d => d.group_name === groupName);
        if (section) return sameName.find(d => d.section === section) || null;
        return sameName.find(d => d.section === '') || sameName[0] || null;
    }

    return {
        // ===== ACCOUNTS =====
        async login(username, password) {
            const acct = await firstDoc(COLL_ACCOUNTS, [['username', '==', username]]);
            if (!acct) return { status: 'error', message: 'Invalid username or password!' };
            if (acct.status === 'pending') {
                return { status: 'error', message: 'Your account is pending approval. Please wait for an admin to approve your account.' };
            }
            const hash = await hashPassword(password);
            if (hash !== acct.password) return { status: 'error', message: 'Invalid username or password!' };
            return {
                status: 'success',
                message: 'Login successful!',
                name: acct.instructor_name,
                user: { id: acct.id, instructor_name: acct.instructor_name, username: acct.username }
            };
        },

        async signup(name, username, password) {
            const exists = await firstDoc(COLL_ACCOUNTS, [['username', '==', username]]);
            if (exists) return { status: 'error', message: 'Username already exists!' };
            const hash = await hashPassword(password);
            const instructorName = String(name || '').trim().toUpperCase();
            if (!instructorName) return { status: 'error', message: 'Full name is required' };
            await db.collection(COLL_ACCOUNTS).add({
                instructor_name: instructorName,
                username: username,
                password: hash,
                status: 'pending'
            });
            return { status: 'success', message: 'Account created! Waiting for admin approval. You cannot login until approved.' };
        },

        async studentLogin(name, section) {
            const nm = String(name || '').trim().toUpperCase();
            if (!nm) return { status: 'error', message: 'Please enter your name' };
            if (!section) return { status: 'error', message: 'Please select your section' };
            const grp = await findGroupByMember(nm, section);
            if (!grp) return { status: 'error', message: 'Name not found in the selected section. Please ask your instructor to register you first.' };
            return {
                status: 'success',
                message: 'Welcome, ' + nm + '!',
                name: nm,
                instructor: grp.instructor,
                group: grp.group_name,
                section: grp.section || section,
                student: { id: grp.id, name: nm, group: grp.group_name, instructor: grp.instructor, section: grp.section || section }
            };
        },

        async getPendingAccounts() {
            const docs = await queryWhere(COLL_ACCOUNTS, [['status', '==', 'pending']]);
            docs.sort((a, b) => (a.id < b.id ? -1 : 1));
            return { status: 'success', accounts: docs.map(d => ({ id: d.id, instructor_name: d.instructor_name, username: d.username })) };
        },

        async getApprovedAccounts() {
            const docs = await queryWhere(COLL_ACCOUNTS, [['status', '==', 'approved']]);
            docs.sort((a, b) => (a.id < b.id ? -1 : 1));
            return { status: 'success', accounts: docs.map(d => ({ id: d.id, instructor_name: d.instructor_name, username: d.username })) };
        },

        async approveAccount(id) {
            const doc = await db.collection(COLL_ACCOUNTS).doc(id).get();
            if (!doc.exists) return { status: 'error', message: 'Account not found or already approved' };
            await doc.ref.update({ status: 'approved' });
            return { status: 'success', message: 'Account approved successfully!' };
        },

        async deleteAccount(id, currentUsername) {
            const doc = await db.collection(COLL_ACCOUNTS).doc(id).get();
            if (!doc.exists) return { status: 'error', message: 'Account not found' };
            if (currentUsername && doc.data().username === currentUsername) return { status: 'error', message: 'Cannot delete your own account' };
            const instructorName = doc.data().instructor_name;
            await deleteWhere(COLL_GROUPS, [['instructor', '==', instructorName]]);
            await deleteWhere(COLL_RATINGS, [['instructor', '==', instructorName]]);
            await deleteWhere(COLL_SECTIONS, [['instructor', '==', instructorName]]);
            await doc.ref.delete();
            return { status: 'success', message: 'Account and all related data deleted successfully!' };
        },

        async updateAccount(action, username, value) {
            const acct = await firstDoc(COLL_ACCOUNTS, [['username', '==', username]]);
            if (!acct) return { status: 'error', message: 'Account not found' };
            if (action === 'update_username') {
                const newUsername = String(value || '').trim();
                if (!newUsername) return { status: 'error', message: 'Username cannot be empty' };
                const dup = await firstDoc(COLL_ACCOUNTS, [['username', '==', newUsername]]);
                if (dup) return { status: 'error', message: 'Username already taken' };
                await db.collection(COLL_ACCOUNTS).doc(acct.id).update({ username: newUsername });
                return { status: 'success', message: 'Username updated' };
            }
            if (action === 'update_password') {
                const hash = await hashPassword(value || '');
                await db.collection(COLL_ACCOUNTS).doc(acct.id).update({ password: hash });
                return { status: 'success', message: 'Password updated' };
            }
            return { status: 'error', message: 'Invalid action' };
        },

        async resetRatings(instructor_name, username) {
            const typed = String(instructor_name || '').trim().toUpperCase();
            if (!typed || !username) return { status: 'error', message: 'Instructor name and username required' };
            const acct = await firstDoc(COLL_ACCOUNTS, [['username', '==', username]]);
            if (!acct) return { status: 'error', message: 'Account not found' };
            if (String(acct.instructor_name || '').trim().toUpperCase() !== typed) {
                return { status: 'error', message: 'Name does not match your account. Reset cancelled.' };
            }
            const deleted = await deleteWhere(COLL_RATINGS, [['instructor', '==', acct.instructor_name]]);
            return { status: 'success', message: 'All your ratings cleared. ' + deleted + ' row(s) deleted.' };
        },

        // ===== SECTIONS =====
        async getSections(instructor) {
            if (!instructor) return { status: 'error', message: 'instructor required' };
            const docs = await queryWhere(COLL_SECTIONS, [['instructor', '==', instructor]]);
            docs.sort((a, b) => String(a.section_name).localeCompare(String(b.section_name)));
            return { status: 'success', sections: docs.map(d => ({ section_name: d.section_name, max_score: d.max_score || 1000 })) };
        },

        async getSectionConfig(instructor, section_name) {
            if (!instructor || !section_name) return { status: 'error', message: 'instructor and section_name required' };
            const doc = await firstDoc(COLL_SECTIONS, [['instructor', '==', instructor], ['section_name', '==', section_name]]);
            return { status: 'success', max_score: doc ? (doc.max_score || 1000) : 1000 };
        },

        async getAllSections() {
            const docs = await queryWhere(COLL_SECTIONS, []);
            const seen = {};
            docs.forEach(d => { if (d.section_name && !seen[d.section_name]) seen[d.section_name] = true; });
            return { status: 'success', sections: Object.keys(seen).sort() };
        },

        async saveSectionConfig(instructor, section_name, new_section_name, max_score) {
            if (!instructor) return { status: 'error', message: 'instructor required' };
            const name = new_section_name || section_name;
            const maxSc = max_score || 1000;
            const existing = await firstDoc(COLL_SECTIONS, [['instructor', '==', instructor], ['section_name', '==', section_name]]);
            if (existing) {
                if (new_section_name && new_section_name !== section_name) {
                    const dup = await firstDoc(COLL_SECTIONS, [['instructor', '==', instructor], ['section_name', '==', new_section_name]]);
                    if (dup) return { status: 'error', message: 'Section name already exists' };

                    const oldGroups = await queryWhere(COLL_GROUPS, [['instructor', '==', instructor], ['section', '==', section_name]]);
                    for (const g of oldGroups) {
                        const newId = groupDocId(instructor, new_section_name, g.group_name);
                        if (g.id === newId) {
                            await db.collection(COLL_GROUPS).doc(g.id).update({ section: new_section_name });
                        } else {
                            const newData = Object.assign({}, g);
                            delete newData.id;
                            newData.section = new_section_name;
                            await db.collection(COLL_GROUPS).doc(newId).set(newData);
                            await db.collection(COLL_GROUPS).doc(g.id).delete();
                        }
                    }

                    const oldRatings = await queryWhere(COLL_RATINGS, [['instructor', '==', instructor], ['section', '==', section_name]]);
                    for (const r of oldRatings) {
                        const newId = ratingDocId(r.rater_name, r.group_name, new_section_name);
                        if (r.id === newId) {
                            await db.collection(COLL_RATINGS).doc(r.id).update({ section: new_section_name });
                        } else {
                            const newData = Object.assign({}, r);
                            delete newData.id;
                            newData.section = new_section_name;
                            await db.collection(COLL_RATINGS).doc(newId).set(newData);
                            await db.collection(COLL_RATINGS).doc(r.id).delete();
                        }
                    }

                    const newSecId = sectionDocId(instructor, new_section_name);
                    if (existing.id !== newSecId) {
                        await db.collection(COLL_SECTIONS).doc(newSecId).set({
                            instructor: instructor,
                            section_name: new_section_name,
                            max_score: maxSc
                        });
                        await db.collection(COLL_SECTIONS).doc(existing.id).delete();
                    } else {
                        await db.collection(COLL_SECTIONS).doc(existing.id).update({ max_score: maxSc });
                    }
                } else {
                    await db.collection(COLL_SECTIONS).doc(existing.id).update({ max_score: maxSc });
                }
            } else {
                await db.collection(COLL_SECTIONS).doc(sectionDocId(instructor, name)).set({
                    instructor: instructor,
                    section_name: name,
                    max_score: maxSc
                });
            }
            return { status: 'success', message: 'Section config saved' };
        },

        async deleteSection(instructor, section_name) {
            if (!instructor || !section_name) return { status: 'error', message: 'instructor and section_name required' };
            await deleteWhere(COLL_RATINGS, [['instructor', '==', instructor], ['section', '==', section_name]]);
            await deleteWhere(COLL_GROUPS, [['instructor', '==', instructor], ['section', '==', section_name]]);
            await deleteWhere(COLL_SECTIONS, [['instructor', '==', instructor], ['section_name', '==', section_name]]);
            return { status: 'success', message: 'Section and all its data deleted' };
        },

        // ===== GROUPS =====
        async getGroups(instructor, section) {
            if (!instructor) return { status: 'error', message: 'instructor parameter required' };
            const conds = [['instructor', '==', instructor]];
            if (section) conds.push(['section', '==', section]);
            const groups = await queryWhere(COLL_GROUPS, conds);
            const ratingConds = [['instructor', '==', instructor]];
            if (section) ratingConds.push(['section', '==', section]);
            const ratings = await queryWhere(COLL_RATINGS, ratingConds);
            const sums = {};
            ratings.forEach(r => {
                sums[r.group_name] = sums[r.group_name] || { total: 0, count: 0 };
                sums[r.group_name].total += (r.total_score || 0);
                sums[r.group_name].count += 1;
            });
            const response = {};
            const existingGroups = new Set();
            groups.forEach(g => {
                const gn = g.group_name;
                if (gn) existingGroups.add(gn);
            });
            GROUP_NAMES.forEach(gn => existingGroups.add(gn));
            existingGroups.forEach(gn => {
                const g = pickGroupDoc(groups, instructor, section, gn) || {};
                const sum = sums[gn] || { total: 0, count: 0 };
                response[gn] = {
                    group_name: gn,
                    member1_name: g.member1_name || '',
                    member2_name: g.member2_name || '',
                    member3_name: g.member3_name || '',
                    member4_name: g.member4_name || '',
                    member5_name: g.member5_name || '',
                    member6_name: g.member6_name || '',
                    is_closed: g.is_closed ? 1 : 0,
                    total_score: sum.total,
                    num_ratings: sum.count
                };
            });
            return { status: 'success', groups: response };
        },

        async addGroup(instructor, section) {
            if (!instructor) return { status: 'error', message: 'instructor parameter required' };
            if (!section) return { status: 'error', message: 'Create a section first to add groups' };
            const groups = await queryWhere(COLL_GROUPS, [['instructor', '==', instructor], ['section', '==', section]]);
            const existingNums = [];
            groups.forEach(g => {
                const match = String(g.group_name || '').match(/^GROUP\s+(\d+)$/i);
                if (match) existingNums.push(parseInt(match[1], 10));
            });
            const defaultNums = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
            defaultNums.forEach(n => { if (!existingNums.includes(n)) existingNums.push(n); });
            let nextNum = 1;
            while (existingNums.includes(nextNum)) nextNum++;
            const groupName = 'GROUP ' + nextNum;
            const data = emptyGroupData(instructor, section, groupName);
            await db.collection(COLL_GROUPS).doc(groupDocId(instructor, section, groupName)).set(data);
            return { status: 'success', message: groupName + ' created', group_name: groupName };
        },

        async removeGroup(instructor, section, groupName) {
            if (!instructor || !groupName) return { status: 'error', message: 'instructor and groupName required' };
            const docs = await queryWhere(COLL_GROUPS, [['instructor', '==', instructor], ['group_name', '==', groupName]]);
            const existing = pickGroupDoc(docs, instructor, section, groupName);
            if (existing) {
                await db.collection(COLL_GROUPS).doc(existing.id).delete();
                await deleteWhere(COLL_RATINGS, [['instructor', '==', instructor], ['group_name', '==', groupName]]);
            }
            return { status: 'success', message: groupName + ' deleted' };
        },

        async getGroupStatus(instructor, section) {
            if (!instructor) return { status: 'error', message: 'instructor parameter required' };
            const conds = [['instructor', '==', instructor]];
            if (section) conds.push(['section', '==', section]);
            const docs = await queryWhere(COLL_GROUPS, conds);
            const status = {};
            const existingGroups = new Set();
            docs.forEach(g => {
                const gn = g.group_name;
                if (gn) existingGroups.add(gn);
                status[gn] = g.is_closed ? 1 : 0;
            });
            GROUP_NAMES.forEach(gn => {
                if (!existingGroups.has(gn)) status[gn] = 0;
            });
            return { status: 'success', groups: status };
        },

        async saveGroupMembers(instructor, group_name, section, m1, m2, m3, m4, m5, m6) {
            if (!instructor || !group_name) return { status: 'error', message: 'instructor and group_name required' };
            if (!section) return { status: 'error', message: 'Create a section first to add members' };
            const members = [m1, m2, m3, m4, m5, m6].map(m => String(m || '').trim().toUpperCase());
            const docs = await queryWhere(COLL_GROUPS, [['instructor', '==', instructor], ['group_name', '==', group_name]]);
            const existing = pickGroupDoc(docs, instructor, section, group_name);
            const hasMember = members.some(m => m !== '');
            if (hasMember) {
                if (existing) {
                    const oldNames = MEMBER_FIELDS.map(f => String(existing[f] || '').trim().toUpperCase());
                    const upd = {
                        member1_name: members[0],
                        member2_name: members[1],
                        member3_name: members[2],
                        member4_name: members[3],
                        member5_name: members[4],
                        member6_name: members[5]
                    };
                    await db.collection(COLL_GROUPS).doc(existing.id).update(upd);
                    for (let i = 0; i < 6; i++) {
                        const o = oldNames[i], n = members[i];
                        if (o && n && o !== n) {
                            await renameRaterRatings(o, n, instructor);
                        }
                    }
                } else {
                    const data = emptyGroupData(instructor, section, group_name);
                    data.member1_name = members[0];
                    data.member2_name = members[1];
                    data.member3_name = members[2];
                    data.member4_name = members[3];
                    data.member5_name = members[4];
                    data.member6_name = members[5];
                    await db.collection(COLL_GROUPS).doc(groupDocId(instructor, section, group_name)).set(data);
                }
            } else if (existing) {
                await db.collection(COLL_GROUPS).doc(existing.id).delete();
            }
            return { status: 'success', message: 'Members saved successfully' };
        },

        async toggleGroupStatus(instructor, group_name, section) {
            if (!instructor || !group_name) return { status: 'error', message: 'instructor and group_name required' };
            const docs = await queryWhere(COLL_GROUPS, [['instructor', '==', instructor], ['group_name', '==', group_name]]);
            const existing = pickGroupDoc(docs, instructor, section, group_name);
            if (existing) {
                const newStatus = existing.is_closed ? 0 : 1;
                await db.collection(COLL_GROUPS).doc(existing.id).update({ is_closed: newStatus });
                return { status: 'success', is_closed: newStatus, message: newStatus ? 'Group closed' : 'Group opened' };
            }
            return { status: 'success', is_closed: 0, message: 'Group opened' };
        },

        // ===== RATINGS =====
        async getMyRatings(rater_name, section) {
            if (!rater_name) return { status: 'error', message: 'rater_name parameter required' };
            const conds = [['rater_name', '==', rater_name]];
            if (section) conds.push(['section', '==', section]);
            const docs = await queryWhere(COLL_RATINGS, conds);
            const ratings = {};
            docs.forEach(d => { ratings[d.group_name] = d; });
            return { status: 'success', ratings: ratings };
        },

        async saveGroupRating(payload) {
            const group_name = payload.group_name || '';
            const rater_name = payload.rater_name || '';
            let section = payload.section || '';
            let instructor = payload.instructor || '';
            if (!instructor) {
                const grp = await findGroupByMember(rater_name, section);
                if (grp) {
                    instructor = grp.instructor;
                    if (!section) section = grp.section || '';
                }
            }
            const s = payload.scores || {};
            const data = {
                rater_name: rater_name,
                group_name: group_name,
                section: section,
                instructor: instructor,
                total_score: payload.total_score || 0,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            // Write per-key fields for the LIVE criteria ids only (single source of
            // truth). Unknown/legacy keys not present in the live set are skipped so
            // old behavior for removed criteria stays preserved in existing docs.
            const live = await getCriteria();
            live.forEach(c => { data[c.id] = s[c.id] || 0; });
            await db.collection(COLL_RATINGS).doc(ratingDocId(rater_name, group_name, section)).set(data);
            return { status: 'success', message: 'Rating saved successfully!', total_score: data.total_score };
        },

        async getStudentRatingsTable(instructor, section) {
            if (!instructor) return { status: 'error', message: 'instructor parameter required' };
            const groupConds = [['instructor', '==', instructor]];
            if (section) groupConds.push(['section', '==', section]);
            const groups = await queryWhere(COLL_GROUPS, groupConds);
            const allRaters = {};
            const allGroupNames = new Set();
            groups.forEach(g => {
                const gn = g.group_name;
                if (gn) allGroupNames.add(gn);
                MEMBER_FIELDS.forEach(f => {
                    const n = String(g[f] || '').trim().toUpperCase();
                    if (n) allRaters[n] = true;
                });
            });
            GROUP_NAMES.forEach(gn => allGroupNames.add(gn));
            const ratingConds = [['instructor', '==', instructor]];
            if (section) ratingConds.push(['section', '==', section]);
            const ratings = await queryWhere(COLL_RATINGS, ratingConds);
            const ratersWithRatings = {};
            ratings.forEach(r => {
                const rn = String(r.rater_name || '').trim().toUpperCase();
                if (!rn) return;
                ratersWithRatings[rn] = ratersWithRatings[rn] || {};
                ratersWithRatings[rn][r.group_name] = r.total_score || 0;
            });
            const allNames = Object.keys(allRaters);
            Object.keys(ratersWithRatings).forEach(n => {
                if (!allRaters[n]) allNames.push(n);
            });
            allNames.sort();
            const response = allNames.map(name => {
                const entry = { name: name };
                allGroupNames.forEach(gn => {
                    entry[gn] = (ratersWithRatings[name] && ratersWithRatings[name][gn] !== undefined) ? ratersWithRatings[name][gn] : null;
                });
                return entry;
            });
            return { status: 'success', ratings: response };
        },

        async getRaterList(instructor, section) {
            if (!instructor) return { status: 'error', message: 'instructor parameter required' };
            const groupConds = [['instructor', '==', instructor]];
            if (section) groupConds.push(['section', '==', section]);
            const groups = await queryWhere(COLL_GROUPS, groupConds);
            const students = {};
            const allGroupNames = new Set();
            groups.forEach(g => {
                const gn = g.group_name;
                if (gn) allGroupNames.add(gn);
                MEMBER_FIELDS.forEach(f => {
                    const n = String(g[f] || '').trim().toUpperCase();
                    if (n) students[n] = true;
                });
            });
            GROUP_NAMES.forEach(gn => allGroupNames.add(gn));
            const ratingConds = [['instructor', '==', instructor]];
            if (section) ratingConds.push(['section', '==', section]);
            const ratings = await queryWhere(COLL_RATINGS, ratingConds);
            const voted = {};
            ratings.forEach(r => {
                const rn = String(r.rater_name || '').trim().toUpperCase();
                if (!rn) return;
                voted[rn] = voted[rn] || {};
                voted[rn][r.group_name] = true;
            });
            const studentList = Object.keys(students).sort();
            const result = studentList.map(sname => {
                const entry = { name: sname };
                allGroupNames.forEach(gn => {
                    entry[gn] = (voted[sname] && voted[sname][gn]) ? 1 : 0;
                });
                return entry;
            });
            return { status: 'success', raters: result };
        },

        async getStudentDetail(rater_name, instructor, section) {
            if (!rater_name || !instructor) return { status: 'error', message: 'rater_name and instructor required' };
            const conds = [['rater_name', '==', rater_name], ['instructor', '==', instructor]];
            if (section) conds.push(['section', '==', section]);
            const docs = await queryWhere(COLL_RATINGS, conds);
            docs.sort((a, b) => String(a.group_name).localeCompare(String(b.group_name)));
            const live = await getCriteria();
            const ratings = docs.map(d => {
                const entry = { group_name: d.group_name, total_score: d.total_score || 0 };
                live.forEach(c => { entry[c.id] = d[c.id] || 0; });
                return entry;
            });
            return { status: 'success', rater_name: rater_name, ratings: ratings };
        },

        // ===== CRITERIA (RUBRIC) =====
        async getCriteria() { return getCriteria(); },

        async seedCriteriaIfEmpty() { return seedCriteriaIfEmpty(); },

        async saveCriterion(rec) {
            if (!rec || !rec.id) return { status: 'error', message: 'Criterion id required' };
            await db.collection(COLL_CRITERIA).doc('C_' + rec.id).set({
                id: rec.id,
                name: String(rec.name || '').trim(),
                desc4: String(rec.desc4 || '').trim(),
                desc3: String(rec.desc3 || '').trim(),
                desc2: String(rec.desc2 || '').trim(),
                desc1: String(rec.desc1 || '').trim(),
                position: typeof rec.position === 'number' ? rec.position : 0,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            criteriaCache = null;
            return { status: 'success', message: 'Criterion saved' };
        },

        async deleteCriterion(id) {
            if (!id) return { status: 'error', message: 'Criterion id required' };
            await db.collection(COLL_CRITERIA).doc('C_' + id).delete();
            criteriaCache = null;
            return { status: 'success', message: 'Criterion deleted' };
        },

        async reorderCriteria(orderedIds) {
            if (!Array.isArray(orderedIds) || orderedIds.length === 0) return { status: 'error', message: 'orderedIds required' };
            const batch = db.batch();
            orderedIds.forEach((id, i) => {
                batch.update(db.collection(COLL_CRITERIA).doc('C_' + id), { position: i });
            });
            await batch.commit();
            criteriaCache = null;
            return { status: 'success', message: 'Criteria order updated' };
        }
    };
})();
