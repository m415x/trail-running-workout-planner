import type Database from 'better-sqlite3'

export function seedKan615PreservationData(
  sqlite: Database.Database,
): void {
  sqlite.exec(`
      INSERT INTO teams (id, created_at, updated_at, name)
      VALUES ('team-1', 'now', 'now', 'Team');

      INSERT INTO users (
        id, created_at, updated_at,
        user_name, email, first_name, last_name
      ) VALUES (
        'user-1', 'now', 'now',
        'runner', 'runner@example.test', 'Ana', 'Runner'
      );

      INSERT INTO athlete_groups (
        id, created_at, updated_at,
        team_id, category_code, level_code
      ) VALUES (
        'group-1', 'now', 'now', 'team-1', 'S', '2'
      );

      INSERT INTO athlete_profiles (
        id, created_at, updated_at, user_id, team_id, dni
      ) VALUES (
        'athlete-1', 'now', 'now', 'user-1', 'team-1', '123'
      );

      INSERT INTO planning_cohorts (
        id, created_at, updated_at,
        team_id, group_id, name, purpose
      ) VALUES (
        'cohort-1', 'now', 'now',
        'team-1', 'group-1', 'Preservation', 'training'
      );

      INSERT INTO group_training_plans (
        id, created_at, updated_at, group_id, title
      ) VALUES (
        'plan-1', 'now', 'now', 'group-1', 'Preservation plan'
      );

      INSERT INTO macrocycles (
        id, created_at, updated_at,
        group_training_plan_id, title,
        start_date, end_date
      ) VALUES (
        'macro-1', 'now', 'now', 'plan-1', 'Macro',
        '2026-09-01', '2026-12-31'
      );

      INSERT INTO mesocycles (
        id, created_at, updated_at,
        macrocycle_id, title, number, period, objective
      ) VALUES (
        'meso-1', 'now', 'now',
        'macro-1', 'Meso', 1, 'base', 'Preparation'
      );

      INSERT INTO microcycles (
        id, created_at, updated_at,
        mesocycle_id, week_number, type,
        start_date, end_date
      ) VALUES (
        'micro-1', 'now', 'now',
        'meso-1', 1, 'load',
        '2026-09-21', '2026-09-27'
      );

      INSERT INTO sessions (
        id, created_at, updated_at,
        team_id, date, title, type
      ) VALUES (
        'session-1', 'now', 'now',
        'team-1', '2026-09-22', 'Preservation', 'Trail'
      );

      INSERT INTO group_session_prescriptions (
        id, created_at, updated_at,
        session_id, group_id, microcycle_id
      ) VALUES (
        'prescription-1', 'now', 'now',
        'session-1', 'group-1', 'micro-1'
      );

      INSERT INTO competition_entries (
        id, group_training_plan_id,
        name, date, distance_km, priority,
        created_at, updated_at
      ) VALUES (
        'competition-1', 'plan-1',
        'Test Race', '2026-11-01', 21, 'B',
        'now', 'now'
      );
    `)
  sqlite.exec(`
      INSERT INTO athlete_billing_terms (
        id, created_at, updated_at, athlete_id,
        monthly_amount_minor, currency, effective_from
      ) VALUES (
        'term-1', 'now', 'now', 'athlete-1',
        2500000, 'ARS', '2026-09-01'
      );

      INSERT INTO athlete_session_adjustments (
        id, created_at, updated_at, team_id,
        athlete_id, source_prescription_id
      ) VALUES (
        'adjustment-1', 'now', 'now', 'team-1',
        'athlete-1', 'prescription-1'
      );

      INSERT INTO field_performance_tests (
        id, created_at, updated_at, athlete_id,
        performed_at, protocol, source,
        distance_m, elapsed_time_sec
      ) VALUES (
        'field-test-1', 'now', 'now', 'athlete-1',
        '2026-09-22', '1000m_track', 'coach_manual', 1000, 301
      );

      INSERT INTO group_history_records (
        id, created_at, updated_at, athlete_id,
        date, new_group_id
      ) VALUES (
        'history-1', 'now', 'now', 'athlete-1',
        '2026-09-22', 'group-1'
      );

      INSERT INTO memberships (
        id, created_at, updated_at, athlete_id,
        start_date, end_date, amount
      ) VALUES (
        'membership-1', 'now', 'now', 'athlete-1',
        '2026-09-01', '2026-09-30', 25000
      );

      INSERT INTO monthly_charges (
        id, created_at, updated_at, athlete_id,
        billing_terms_id, year, month,
        base_amount_minor, amount_due_minor,
        currency, base_due_date, effective_due_date
      ) VALUES (
        'charge-1', 'now', 'now', 'athlete-1',
        'term-1', 2026, 9,
        2500000, 2500000,
        'ARS', '2026-09-05', '2026-09-05'
      );

      INSERT INTO physiology_records (
        id, created_at, updated_at, athlete_id,
        date, pam_time_sec, pam_pace_formatted,
        max_hr, rest_hr
      ) VALUES (
        'physiology-1', 'now', 'now', 'athlete-1',
        '2026-09-22', 301, '5:01', 185, 55
      );

      INSERT INTO planning_cohort_memberships (
        id, created_at, updated_at,
        planning_cohort_id, athlete_profile_id,
        start_date
      ) VALUES (
        'cohort-member-1', 'now', 'now',
        'cohort-1', 'athlete-1', '2026-09-01'
      );

      INSERT INTO readiness_evaluations (
        id, created_at, updated_at, team_id,
        athlete_id, competition_entry_id,
        evaluated_at, analysis_start_date,
        analysis_end_date, policy_version,
        policy_snapshot, preparation_snapshot,
        phase_snapshot, result_snapshot
      ) VALUES (
        'readiness-1', 'now', 'now', 'team-1',
        'athlete-1', 'competition-1',
        '2026-09-22', '2026-09-01',
        '2026-09-22', 'fixture-v1',
        '{}', '{}', '{}', '{}'
      );

      INSERT INTO shoes (
        id, created_at, updated_at, athlete_id,
        type, brand, model, max_km
      ) VALUES (
        'shoes-1', 'now', 'now', 'athlete-1',
        'trail', 'Example', 'Mountain', 800
      );

      INSERT INTO training_goals (
        id, created_at, updated_at, athlete_id,
        type, title
      ) VALUES (
        'goal-1', 'now', 'now', 'athlete-1',
        'race', 'Finish trail race'
      );

      INSERT INTO workout_logs (
        id, created_at, updated_at, athlete_id,
        date, logged_at
      ) VALUES (
        'workout-1', 'now', 'now', 'athlete-1',
        '2026-09-22', '2026-09-22T12:00:00Z'
      );
    `)
}
