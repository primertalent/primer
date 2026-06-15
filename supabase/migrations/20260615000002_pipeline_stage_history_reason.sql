alter table pipeline_stage_history
  add column stage_change_reason text,
  add constraint psh_stage_change_reason_check
    check (stage_change_reason is null or stage_change_reason in (
      'client_added_step', 'candidate_bumped', 'correction', 'other'
    ));
