-- Detach debriefs for the two rows with debrief history before delete.
-- ON DELETE CASCADE on debriefs.pipeline_id would destroy them otherwise.
update debriefs
  set pipeline_id = null
  where pipeline_id in (
    '2b16b547-cbff-48ec-aa2d-e1b73a9ea641',
    '69328c50-2cf0-45f3-bf1b-d36a93e76f7a'
  );

-- Delete all three pre-submittal pipeline rows by explicit ID.
-- Nick (d9ba...) has no debrief — no detach step needed.
delete from pipelines
  where id in (
    '2b16b547-cbff-48ec-aa2d-e1b73a9ea641',
    '69328c50-2cf0-45f3-bf1b-d36a93e76f7a',
    'd9ba42b3-f416-491f-8cf5-3f28939726b7'
  );

-- Add new columns.
alter table pipelines
  add column stage_reached  text,
  add column lost_reason    text,
  add column start_date     date,
  add column guarantee_days integer default 90;

-- Remap stage values to canonical set.
-- accepted/offer accepted -> placed, stage_reached = offer (acceptance is the win)
update pipelines
  set current_stage = 'placed',
      stage_reached = 'offer'
  where lower(trim(current_stage)) in ('accepted', 'offer accepted');

-- Normalize existing placed/lost in case of capitalization drift
update pipelines set current_stage = 'placed'
  where lower(trim(current_stage)) = 'placed';
update pipelines set current_stage = 'lost'
  where lower(trim(current_stage)) = 'lost';

-- offer variants -> offer (verbal offer = offer in motion)
update pipelines
  set current_stage = 'offer'
  where lower(trim(current_stage)) in ('offer', 'offer extended', 'offered', 'verbal', 'verbal offer');

-- final round variants -> final_round
update pipelines
  set current_stage = 'final_round'
  where lower(trim(current_stage)) in ('final round', 'final_round', 'final interview', 'late stage', 'late_stage');

-- middle round -> middle_round
update pipelines
  set current_stage = 'middle_round'
  where lower(trim(current_stage)) in ('second interview', '2nd interview');

-- first round variants -> first_round
update pipelines
  set current_stage = 'first_round'
  where lower(trim(current_stage)) in (
    'first_round', 'interviewing', 'interview',
    'first interview', '1st interview', 'phone interview'
  );

-- submitted variants -> submitted
update pipelines
  set current_stage = 'submitted'
  where lower(trim(current_stage)) in ('submitted', 'submitting');

-- CHECK constraints.
-- If any value was missed by the remap above, ADD CONSTRAINT fails here
-- and surfaces it before the migration commits.
alter table pipelines
  add constraint pipelines_current_stage_check
    check (current_stage in (
      'submitted', 'first_round', 'middle_round', 'final_round',
      'offer', 'placed', 'lost'
    )),
  add constraint pipelines_lost_reason_check
    check (lost_reason is null or lost_reason in (
      'rejected', 'withdrawn', 'counteroffer', 'lost_to_offer',
      'role_closed', 'fell_through', 'unresponsive', 'comp', 'other'
    ));
