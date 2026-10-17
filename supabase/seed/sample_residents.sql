-- ---------------------------------------------------------------------------
-- Sample resident records for demoing / testing the app.
--
-- EVERYTHING BELOW IS FICTIONAL. The people, rooms, clinical notes and phone
-- numbers are invented for demonstration and must not be used as real records.
-- Phone numbers use Ofcom's 07700 900xxx range, which exists specifically for
-- fictitious use and can never connect to a real line.
--
-- Safe to re-run: every row uses a fixed id with `on conflict do nothing`, so
-- running this twice will not create duplicates.
--
-- To remove all of it again (contacts, care notes and any AI output on these
-- residents cascade away automatically):
--
--   delete from public.residents where id in (
--     '10000000-0000-4000-8000-000000000001',
--     '10000000-0000-4000-8000-000000000002',
--     '10000000-0000-4000-8000-000000000003',
--     '10000000-0000-4000-8000-000000000004',
--     '10000000-0000-4000-8000-000000000005',
--     '10000000-0000-4000-8000-000000000006'
--   );
-- ---------------------------------------------------------------------------

insert into public.residents (id, name, dob, room_number, admission_date, care_needs)
values
  (
    '10000000-0000-4000-8000-000000000001',
    'Margaret Ellery',
    '1941-03-12',
    '3',
    '2023-06-05',
    'Early-stage Alzheimer''s. Oriented to person but not always to time or place; needs gentle prompting to complete personal care and to eat. Mobile with a wheeled walking frame and one-person supervision to reduce falls risk. Soft, moist diet with thickened fluids due to a choking risk. Takes medication with yoghurt at breakfast. Wears a hearing aid in each ear - check batteries and refit every morning. At risk of walking towards the front door in the late afternoon.'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    'Arthur Boateng',
    '1938-11-02',
    '7',
    '2022-01-17',
    'Type 2 diabetes managed with twice-daily insulin. Capillary blood glucose before breakfast and before the evening meal, plus a snack at 15:00 to prevent hypoglycaemia. Full assistance with washing and dressing because of a frozen right shoulder. Hoisted for all transfers with a two-person assist. Portioned, low-sugar diet. Right eye cataract surgery pending. Alert and sociable - enjoys the daily crossword.'
  ),
  (
    '10000000-0000-4000-8000-000000000003',
    'Doris Hargreaves',
    '1936-07-28',
    '11',
    '2021-09-14',
    'Mid-stage dementia with episodes of agitation in the early evening. Responds best to a calm approach and familiar staff. Fully dependent for all personal care. Pureed diet with thickened fluids, plus a fortified mid-morning drink. Urinary catheter in situ - check output and skin integrity every shift. Do not attempt to move without the hoist. DNACPR and Ceiling of Treatment forms are held in the care plan.'
  ),
  (
    '10000000-0000-4000-8000-000000000004',
    'Terence Okonkwo',
    '1944-02-09',
    '5',
    '2024-01-22',
    'COPD with reduced exercise tolerance following a recent flare. Uses a four-wheeled walker with a seat and needs a rest after roughly 30 metres. Two litres of oxygen via nasal cannula overnight as prescribed. Independent with personal care but needs help with buttons and foot care. Small, frequent meals - eats slowly and tires quickly. Record oxygen saturation every morning. Non-smoker; reinforce that daily.'
  ),
  (
    '10000000-0000-4000-8000-000000000005',
    'Joan Whitcombe',
    '1947-05-30',
    '2',
    '2024-03-11',
    'Recovering from a fractured neck of femur. Weight-bear as tolerated with a walking frame; two-person stand-and-transfer. Daily physiotherapy exercises at 10:00. Independent with eating and drinking. Renal diet with a fluid restriction of 1.5 litres a day. On warfarin - INR check every Tuesday and watch for bruising or bleeding. Motivated with her rehabilitation and keen to get back to the garden.'
  ),
  (
    '10000000-0000-4000-8000-000000000006',
    'Frederick Ashworth',
    '1939-09-16',
    '9',
    '2022-11-03',
    'Vascular dementia with a mild left-sided weakness from a previous stroke; the left arm needs support when dressing and eating. Speaks in short phrases and understands simple one-step instructions - allow extra time. Independent with a stick around his room; supervise walking in the corridor. Regular diet with no texture modification, but he forgets to drink - offer fluids hourly. Partial dentures: check they are in for meals and out at night.'
  )
on conflict (id) do nothing;

insert into public.emergency_contacts (id, resident_id, name, relationship, phone)
values
  ('20000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Ellen Fairbrother', 'Daughter', '07700 900118'),
  ('20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', 'Michael Ellery', 'Son', '07700 900241'),
  ('20000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002', 'Grace Boateng', 'Daughter', '07700 900472'),
  ('20000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000003', 'Susan Pickering', 'Niece - next of kin', '07700 900663'),
  ('20000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000003', 'Ivy Chadwick', 'Neighbour', '07700 900714'),
  ('20000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000004', 'Ngozi Okonkwo', 'Wife', '07700 900305'),
  ('20000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000004', 'Chidi Okonkwo', 'Son', '07700 900338'),
  ('20000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000005', 'Peter Whitcombe', 'Son', '07700 900907'),
  ('20000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000006', 'Helen Ashworth', 'Daughter', '07700 900556')
on conflict (id) do nothing;

-- Recent care notes, so the shift-handover summary has something real to read.
-- author_id is intentionally left null: these predate any staff account, and the
-- timeline renders an unknown author as "Staff member".
insert into public.care_notes (id, resident_id, body, created_at)
values
  (
    '30000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'Prompted with personal care at 07:30 and needed reminding twice to finish. Ate a full bowl of porridge with thickened tea. Hearing aids checked and the left battery replaced.',
    now() - interval '2 days 3 hours'
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000001',
    'Became unsettled at about 16:00 and twice walked towards the front door asking for her husband, who died in 2016. Redirected to the lounge with a cup of tea and settled within 15 minutes. Please keep an eye on the hallway between 15:30 and 17:00.',
    now() - interval '14 hours'
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000002',
    'Blood glucose 5.4 before breakfast. Insulin given at 08:10 as prescribed. Ate most of breakfast and the 15:00 snack. No signs of hypoglycaemia observed.',
    now() - interval '1 day 2 hours'
  ),
  (
    '30000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000002',
    'Hoisted for a shower with two staff and tolerated it well. Reported some discomfort in the right shoulder while dressing - flagged for the physiotherapy review on Thursday.',
    now() - interval '3 days 5 hours'
  ),
  (
    '30000000-0000-4000-8000-000000000005',
    '10000000-0000-4000-8000-000000000003',
    'Catheter output 1,400ml over 24 hours - clear and straw-coloured. Skin around the site intact with no redness. Repositioned two-hourly through the night.',
    now() - interval '1 day 8 hours'
  ),
  (
    '30000000-0000-4000-8000-000000000006',
    '10000000-0000-4000-8000-000000000003',
    'Agitated from about 18:30, calling out for her mother. Sat with her in a quiet corner with the radio on and she settled by 19:20. No PRN medication needed.',
    now() - interval '2 days 12 hours'
  ),
  (
    '30000000-0000-4000-8000-000000000007',
    '10000000-0000-4000-8000-000000000004',
    'Oxygen saturation 91% on air this morning, rising to 95% on 2 litres as charted overnight. Needed a rest after walking to the dining room. Ate half of a small breakfast.',
    now() - interval '20 hours'
  ),
  (
    '30000000-0000-4000-8000-000000000008',
    '10000000-0000-4000-8000-000000000004',
    'Physio walked him out to the garden and back with the four-wheeled walker - managed it with one sit-down on the return. Very pleased with himself.',
    now() - interval '4 days 4 hours'
  ),
  (
    '30000000-0000-4000-8000-000000000009',
    '10000000-0000-4000-8000-000000000005',
    'INR 2.6 this week, within range. No bruising or bleeding noted. Encouraged fluids and she took about 1.2 litres over the day.',
    now() - interval '2 days 6 hours'
  ),
  (
    '30000000-0000-4000-8000-000000000010',
    '10000000-0000-4000-8000-000000000005',
    'Completed her exercises with the physio and stood with the frame for two minutes with no staff support. Good progress - she is asking when she can get back out to the garden.',
    now() - interval '11 hours'
  ),
  (
    '30000000-0000-4000-8000-000000000011',
    '10000000-0000-4000-8000-000000000006',
    'Dentures in for all meals, then removed and cleaned at bedtime. Ate well at lunch but needed reminding to drink - offered fluids hourly through the afternoon.',
    now() - interval '3 days 9 hours'
  ),
  (
    '30000000-0000-4000-8000-000000000012',
    '10000000-0000-4000-8000-000000000006',
    'Walked to the lounge with his stick and one-person supervision, steady throughout. Conversation limited to short phrases, but he recognised his daughter on the video call and was cheerful afterwards.',
    now() - interval '16 hours'
  )
on conflict (id) do nothing;
