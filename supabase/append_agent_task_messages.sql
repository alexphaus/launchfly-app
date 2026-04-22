CREATE OR REPLACE FUNCTION append_agent_task_messages(
  p_task_id UUID,
  p_new_messages JSONB,
  p_steps_used INT,
  p_tool_log JSONB
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE agent_tasks
  SET
    messages = COALESCE(messages, '[]'::jsonb) || p_new_messages,
    steps_used = p_steps_used,
    tool_log = p_tool_log,
    updated_at = NOW()
  WHERE id = p_task_id;
END;
$$;
