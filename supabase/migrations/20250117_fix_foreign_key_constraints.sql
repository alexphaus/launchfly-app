-- Fix Foreign Key Constraints Migration
-- This migration adds ON DELETE CASCADE to all foreign key constraints
-- that reference businesses and users tables to enable proper deletion

-- Drop and recreate foreign key constraints with CASCADE behavior

-- 1. Fix fulfillments table (main issue mentioned)
ALTER TABLE fulfillments DROP CONSTRAINT IF EXISTS fulfillments_sale_id_fkey;
ALTER TABLE fulfillments ADD CONSTRAINT fulfillments_sale_id_fkey 
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE;

-- 2. Fix all business_id foreign keys to CASCADE
-- acquisition_campaigns
ALTER TABLE acquisition_campaigns DROP CONSTRAINT IF EXISTS acquisition_campaigns_business_id_fkey;
ALTER TABLE acquisition_campaigns ADD CONSTRAINT acquisition_campaigns_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- ad_campaigns  
ALTER TABLE ad_campaigns DROP CONSTRAINT IF EXISTS ad_campaigns_business_id_fkey;
ALTER TABLE ad_campaigns ADD CONSTRAINT ad_campaigns_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- ai_activities
ALTER TABLE ai_activities DROP CONSTRAINT IF EXISTS ai_activities_business_id_fkey;
ALTER TABLE ai_activities ADD CONSTRAINT ai_activities_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- ai_business_plans (already has CASCADE in migration file, but ensure it exists)
ALTER TABLE ai_business_plans DROP CONSTRAINT IF EXISTS ai_business_plans_business_id_fkey;
ALTER TABLE ai_business_plans ADD CONSTRAINT ai_business_plans_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- ai_cofounder_state (already has CASCADE)
ALTER TABLE ai_cofounder_state DROP CONSTRAINT IF EXISTS ai_cofounder_state_business_id_fkey;
ALTER TABLE ai_cofounder_state ADD CONSTRAINT ai_cofounder_state_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- ai_conversations (already has CASCADE)
ALTER TABLE ai_conversations DROP CONSTRAINT IF EXISTS ai_conversations_business_id_fkey;
ALTER TABLE ai_conversations ADD CONSTRAINT ai_conversations_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- ai_experiment_queue (already has CASCADE)
ALTER TABLE ai_experiment_queue DROP CONSTRAINT IF EXISTS ai_experiment_queue_business_id_fkey;
ALTER TABLE ai_experiment_queue ADD CONSTRAINT ai_experiment_queue_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- ai_experiments (already has CASCADE)
ALTER TABLE ai_experiments DROP CONSTRAINT IF EXISTS ai_experiments_business_id_fkey;
ALTER TABLE ai_experiments ADD CONSTRAINT ai_experiments_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- ai_learning_patterns (already has CASCADE)
ALTER TABLE ai_learning_patterns DROP CONSTRAINT IF EXISTS ai_learning_patterns_business_id_fkey;
ALTER TABLE ai_learning_patterns ADD CONSTRAINT ai_learning_patterns_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- ai_memories (already has CASCADE)
ALTER TABLE ai_memories DROP CONSTRAINT IF EXISTS ai_memories_business_id_fkey;
ALTER TABLE ai_memories ADD CONSTRAINT ai_memories_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- business_proof_pages
ALTER TABLE business_proof_pages DROP CONSTRAINT IF EXISTS business_proof_pages_business_id_fkey;
ALTER TABLE business_proof_pages ADD CONSTRAINT business_proof_pages_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- business_reviews
ALTER TABLE business_reviews DROP CONSTRAINT IF EXISTS business_reviews_business_id_fkey;
ALTER TABLE business_reviews ADD CONSTRAINT business_reviews_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- business_success_predictions
ALTER TABLE business_success_predictions DROP CONSTRAINT IF EXISTS business_success_predictions_business_id_fkey;
ALTER TABLE business_success_predictions ADD CONSTRAINT business_success_predictions_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- campaigns
ALTER TABLE campaigns DROP CONSTRAINT IF EXISTS campaigns_business_id_fkey;
ALTER TABLE campaigns ADD CONSTRAINT campaigns_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- cart_sessions
ALTER TABLE cart_sessions DROP CONSTRAINT IF EXISTS cart_sessions_business_id_fkey;
ALTER TABLE cart_sessions ADD CONSTRAINT cart_sessions_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- clicks
ALTER TABLE clicks DROP CONSTRAINT IF EXISTS clicks_business_id_fkey;
ALTER TABLE clicks ADD CONSTRAINT clicks_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- conversion_events
ALTER TABLE conversion_events DROP CONSTRAINT IF EXISTS conversion_events_business_id_fkey;
ALTER TABLE conversion_events ADD CONSTRAINT conversion_events_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- customer_testimonials
ALTER TABLE customer_testimonials DROP CONSTRAINT IF EXISTS customer_testimonials_business_id_fkey;
ALTER TABLE customer_testimonials ADD CONSTRAINT customer_testimonials_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- customers
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_business_id_fkey;
ALTER TABLE customers ADD CONSTRAINT customers_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- discount_codes
ALTER TABLE discount_codes DROP CONSTRAINT IF EXISTS discount_codes_business_id_fkey;
ALTER TABLE discount_codes ADD CONSTRAINT discount_codes_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- email_conversations
ALTER TABLE email_conversations DROP CONSTRAINT IF EXISTS email_conversations_business_id_fkey;
ALTER TABLE email_conversations ADD CONSTRAINT email_conversations_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- email_outreach
ALTER TABLE email_outreach DROP CONSTRAINT IF EXISTS email_outreach_business_id_fkey;
ALTER TABLE email_outreach ADD CONSTRAINT email_outreach_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- email_replies
ALTER TABLE email_replies DROP CONSTRAINT IF EXISTS email_replies_business_id_fkey;
ALTER TABLE email_replies ADD CONSTRAINT email_replies_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- emails
ALTER TABLE emails DROP CONSTRAINT IF EXISTS emails_business_id_fkey;
ALTER TABLE emails ADD CONSTRAINT emails_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- follow_up_tasks
ALTER TABLE follow_up_tasks DROP CONSTRAINT IF EXISTS follow_up_tasks_business_id_fkey;
ALTER TABLE follow_up_tasks ADD CONSTRAINT follow_up_tasks_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- growth_experiments
ALTER TABLE growth_experiments DROP CONSTRAINT IF EXISTS growth_experiments_business_id_fkey;
ALTER TABLE growth_experiments ADD CONSTRAINT growth_experiments_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- growth_sessions
ALTER TABLE growth_sessions DROP CONSTRAINT IF EXISTS growth_sessions_business_id_fkey;
ALTER TABLE growth_sessions ADD CONSTRAINT growth_sessions_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- guarantee_emergency_actions
ALTER TABLE guarantee_emergency_actions DROP CONSTRAINT IF EXISTS guarantee_emergency_actions_business_id_fkey;
ALTER TABLE guarantee_emergency_actions ADD CONSTRAINT guarantee_emergency_actions_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- guarantee_payouts
ALTER TABLE guarantee_payouts DROP CONSTRAINT IF EXISTS guarantee_payouts_business_id_fkey;
ALTER TABLE guarantee_payouts ADD CONSTRAINT guarantee_payouts_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- inngest_jobs
ALTER TABLE inngest_jobs DROP CONSTRAINT IF EXISTS inngest_jobs_business_id_fkey;
ALTER TABLE inngest_jobs ADD CONSTRAINT inngest_jobs_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- landing_pages (already has CASCADE)
ALTER TABLE landing_pages DROP CONSTRAINT IF EXISTS landing_pages_business_id_fkey;
ALTER TABLE landing_pages ADD CONSTRAINT landing_pages_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- marketing_campaigns
ALTER TABLE marketing_campaigns DROP CONSTRAINT IF EXISTS marketing_campaigns_business_id_fkey;
ALTER TABLE marketing_campaigns ADD CONSTRAINT marketing_campaigns_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- marketplace_listings
ALTER TABLE marketplace_listings DROP CONSTRAINT IF EXISTS marketplace_listings_business_id_fkey;
ALTER TABLE marketplace_listings ADD CONSTRAINT marketplace_listings_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- orders
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_business_id_fkey;
ALTER TABLE orders ADD CONSTRAINT orders_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- outreach_campaigns
ALTER TABLE outreach_campaigns DROP CONSTRAINT IF EXISTS outreach_campaigns_business_id_fkey;
ALTER TABLE outreach_campaigns ADD CONSTRAINT outreach_campaigns_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- product_reviews
ALTER TABLE product_reviews DROP CONSTRAINT IF EXISTS product_reviews_business_id_fkey;
ALTER TABLE product_reviews ADD CONSTRAINT product_reviews_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- products
ALTER TABLE products DROP CONSTRAINT IF EXISTS products_business_id_fkey;
ALTER TABLE products ADD CONSTRAINT products_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- prospects
ALTER TABLE prospects DROP CONSTRAINT IF EXISTS prospects_business_id_fkey;
ALTER TABLE prospects ADD CONSTRAINT prospects_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- revenue_forecasts
ALTER TABLE revenue_forecasts DROP CONSTRAINT IF EXISTS revenue_forecasts_business_id_fkey;
ALTER TABLE revenue_forecasts ADD CONSTRAINT revenue_forecasts_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- revenue_guarantees
ALTER TABLE revenue_guarantees DROP CONSTRAINT IF EXISTS revenue_guarantees_business_id_fkey;
ALTER TABLE revenue_guarantees ADD CONSTRAINT revenue_guarantees_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- revenue_patterns
ALTER TABLE revenue_patterns DROP CONSTRAINT IF EXISTS revenue_patterns_business_id_fkey;
ALTER TABLE revenue_patterns ADD CONSTRAINT revenue_patterns_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- revenue_share_transactions
ALTER TABLE revenue_share_transactions DROP CONSTRAINT IF EXISTS revenue_share_transactions_business_id_fkey;
ALTER TABLE revenue_share_transactions ADD CONSTRAINT revenue_share_transactions_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- revenue_verifications
ALTER TABLE revenue_verifications DROP CONSTRAINT IF EXISTS revenue_verifications_business_id_fkey;
ALTER TABLE revenue_verifications ADD CONSTRAINT revenue_verifications_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- sales
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_business_id_fkey;
ALTER TABLE sales ADD CONSTRAINT sales_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- scheduled_guarantee_checks
ALTER TABLE scheduled_guarantee_checks DROP CONSTRAINT IF EXISTS scheduled_guarantee_checks_business_id_fkey;
ALTER TABLE scheduled_guarantee_checks ADD CONSTRAINT scheduled_guarantee_checks_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- sessions
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_business_id_fkey;
ALTER TABLE sessions ADD CONSTRAINT sessions_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- social_actions
ALTER TABLE social_actions DROP CONSTRAINT IF EXISTS social_actions_business_id_fkey;
ALTER TABLE social_actions ADD CONSTRAINT social_actions_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- social_campaigns
ALTER TABLE social_campaigns DROP CONSTRAINT IF EXISTS social_campaigns_business_id_fkey;
ALTER TABLE social_campaigns ADD CONSTRAINT social_campaigns_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- social_monitoring
ALTER TABLE social_monitoring DROP CONSTRAINT IF EXISTS social_monitoring_business_id_fkey;
ALTER TABLE social_monitoring ADD CONSTRAINT social_monitoring_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- social_platform_accounts
ALTER TABLE social_platform_accounts DROP CONSTRAINT IF EXISTS social_platform_accounts_business_id_fkey;
ALTER TABLE social_platform_accounts ADD CONSTRAINT social_platform_accounts_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- template_reviews
ALTER TABLE template_reviews DROP CONSTRAINT IF EXISTS template_reviews_business_id_fkey;
ALTER TABLE template_reviews ADD CONSTRAINT template_reviews_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- template_usage
ALTER TABLE template_usage DROP CONSTRAINT IF EXISTS template_usage_business_id_fkey;
ALTER TABLE template_usage ADD CONSTRAINT template_usage_business_id_fkey 
  FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE;

-- 3. Fix user_id foreign keys to CASCADE
-- businesses (main table - references auth.users)
ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_user_id_fkey;
ALTER TABLE businesses ADD CONSTRAINT businesses_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- business_reviews
ALTER TABLE business_reviews DROP CONSTRAINT IF EXISTS business_reviews_user_id_fkey;
ALTER TABLE business_reviews ADD CONSTRAINT business_reviews_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- profiles
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE profiles ADD CONSTRAINT profiles_id_fkey 
  FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- revenue_verifications
ALTER TABLE revenue_verifications DROP CONSTRAINT IF EXISTS revenue_verifications_user_id_fkey;
ALTER TABLE revenue_verifications ADD CONSTRAINT revenue_verifications_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- template_reviews (user_id)
ALTER TABLE template_reviews DROP CONSTRAINT IF EXISTS template_reviews_user_id_fkey;
ALTER TABLE template_reviews ADD CONSTRAINT template_reviews_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- template_usage (user_id)  
ALTER TABLE template_usage DROP CONSTRAINT IF EXISTS template_usage_user_id_fkey;
ALTER TABLE template_usage ADD CONSTRAINT template_usage_user_id_fkey 
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- 4. Fix other cascading relationships
-- fulfillment_content -> sales
ALTER TABLE fulfillment_content DROP CONSTRAINT IF EXISTS fulfillment_content_sale_id_fkey;
ALTER TABLE fulfillment_content ADD CONSTRAINT fulfillment_content_sale_id_fkey 
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE;

-- fulfillment_feedback -> sales
ALTER TABLE fulfillment_feedback DROP CONSTRAINT IF EXISTS fulfillment_feedback_sale_id_fkey;
ALTER TABLE fulfillment_feedback ADD CONSTRAINT fulfillment_feedback_sale_id_fkey 
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE;

-- fulfillment_followups -> sales
ALTER TABLE fulfillment_followups DROP CONSTRAINT IF EXISTS fulfillment_followups_sale_id_fkey;
ALTER TABLE fulfillment_followups ADD CONSTRAINT fulfillment_followups_sale_id_fkey 
  FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE;

-- order_items -> orders
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_order_id_fkey;
ALTER TABLE order_items ADD CONSTRAINT order_items_order_id_fkey 
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE;

-- order_items -> products (SET NULL since product might be deleted independently)
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;
ALTER TABLE order_items ADD CONSTRAINT order_items_product_id_fkey 
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;

-- product_reviews -> orders (SET NULL since we want to keep reviews even if order is deleted)
ALTER TABLE product_reviews DROP CONSTRAINT IF EXISTS product_reviews_order_id_fkey;
ALTER TABLE product_reviews ADD CONSTRAINT product_reviews_order_id_fkey 
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

-- product_reviews -> products (SET NULL since we want to keep reviews even if product is deleted)
ALTER TABLE product_reviews DROP CONSTRAINT IF EXISTS product_reviews_product_id_fkey;
ALTER TABLE product_reviews ADD CONSTRAINT product_reviews_product_id_fkey 
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;

-- sales -> orders (SET NULL since we want to keep sales record even if order is deleted)
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_order_id_fkey;
ALTER TABLE sales ADD CONSTRAINT sales_order_id_fkey 
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

-- conversion_events -> products (SET NULL)
ALTER TABLE conversion_events DROP CONSTRAINT IF EXISTS conversion_events_product_id_fkey;
ALTER TABLE conversion_events ADD CONSTRAINT conversion_events_product_id_fkey 
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;

-- clicks -> emails (SET NULL)
ALTER TABLE clicks DROP CONSTRAINT IF EXISTS clicks_email_id_fkey;
ALTER TABLE clicks ADD CONSTRAINT clicks_email_id_fkey 
  FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE SET NULL;

-- clicks -> campaigns (SET NULL)
ALTER TABLE clicks DROP CONSTRAINT IF EXISTS clicks_campaign_id_fkey;
ALTER TABLE clicks ADD CONSTRAINT clicks_campaign_id_fkey 
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL;

-- emails -> campaigns (SET NULL)
ALTER TABLE emails DROP CONSTRAINT IF EXISTS emails_campaign_id_fkey;
ALTER TABLE emails ADD CONSTRAINT emails_campaign_id_fkey 
  FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE SET NULL;

-- email_replies -> emails (CASCADE)
ALTER TABLE email_replies DROP CONSTRAINT IF EXISTS email_replies_email_id_fkey;
ALTER TABLE email_replies ADD CONSTRAINT email_replies_email_id_fkey 
  FOREIGN KEY (email_id) REFERENCES emails(id) ON DELETE CASCADE;

-- social_actions -> prospects (CASCADE)
ALTER TABLE social_actions DROP CONSTRAINT IF EXISTS social_actions_prospect_id_fkey;
ALTER TABLE social_actions ADD CONSTRAINT social_actions_prospect_id_fkey 
  FOREIGN KEY (prospect_id) REFERENCES prospects(id) ON DELETE CASCADE;

-- social_actions -> social_campaigns (SET NULL)
ALTER TABLE social_actions DROP CONSTRAINT IF EXISTS social_actions_campaign_id_fkey;
ALTER TABLE social_actions ADD CONSTRAINT social_actions_campaign_id_fkey 
  FOREIGN KEY (campaign_id) REFERENCES social_campaigns(id) ON DELETE SET NULL;

-- ai_experiment_queue -> ai_experiments (CASCADE for parent)
ALTER TABLE ai_experiment_queue DROP CONSTRAINT IF EXISTS ai_experiment_queue_parent_experiment_id_fkey;
ALTER TABLE ai_experiment_queue ADD CONSTRAINT ai_experiment_queue_parent_experiment_id_fkey 
  FOREIGN KEY (parent_experiment_id) REFERENCES ai_experiments(id) ON DELETE CASCADE;

-- ai_experiment_applications -> ai_experiments (CASCADE)
ALTER TABLE ai_experiment_applications DROP CONSTRAINT IF EXISTS ai_experiment_applications_experiment_id_fkey;
ALTER TABLE ai_experiment_applications ADD CONSTRAINT ai_experiment_applications_experiment_id_fkey 
  FOREIGN KEY (experiment_id) REFERENCES ai_experiments(id) ON DELETE CASCADE;

-- scheduled_guarantee_checks -> revenue_guarantees (CASCADE)
ALTER TABLE scheduled_guarantee_checks DROP CONSTRAINT IF EXISTS scheduled_guarantee_checks_guarantee_id_fkey;
ALTER TABLE scheduled_guarantee_checks ADD CONSTRAINT scheduled_guarantee_checks_guarantee_id_fkey 
  FOREIGN KEY (guarantee_id) REFERENCES revenue_guarantees(id) ON DELETE CASCADE;

-- sessions -> inngest_jobs (SET NULL)
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_inngest_job_id_fkey;
ALTER TABLE sessions ADD CONSTRAINT sessions_inngest_job_id_fkey 
  FOREIGN KEY (inngest_job_id) REFERENCES inngest_jobs(id) ON DELETE SET NULL;

-- businesses -> revenue_guarantees (SET NULL)
ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_guarantee_id_fkey;
ALTER TABLE businesses ADD CONSTRAINT businesses_guarantee_id_fkey 
  FOREIGN KEY (guarantee_id) REFERENCES revenue_guarantees(id) ON DELETE SET NULL;

-- businesses -> business_templates (SET NULL)
ALTER TABLE businesses DROP CONSTRAINT IF EXISTS businesses_template_id_fkey;
ALTER TABLE businesses ADD CONSTRAINT businesses_template_id_fkey 
  FOREIGN KEY (template_id) REFERENCES business_templates(id) ON DELETE SET NULL;

-- businesses -> platform_subscriptions (SET NULL)
ALTER TABLE businesses DROP CONSTRAINT IF EXISTS fk_paid_plan_session;
ALTER TABLE businesses ADD CONSTRAINT fk_paid_plan_session 
  FOREIGN KEY (paid_plan_session_id) REFERENCES platform_subscriptions(stripe_session_id) ON DELETE SET NULL;

-- template_performance_history -> business_templates (CASCADE)
ALTER TABLE template_performance_history DROP CONSTRAINT IF EXISTS template_performance_history_template_id_fkey;
ALTER TABLE template_performance_history ADD CONSTRAINT template_performance_history_template_id_fkey 
  FOREIGN KEY (template_id) REFERENCES business_templates(id) ON DELETE CASCADE;

-- template_reviews -> business_templates (CASCADE)
ALTER TABLE template_reviews DROP CONSTRAINT IF EXISTS template_reviews_template_id_fkey;
ALTER TABLE template_reviews ADD CONSTRAINT template_reviews_template_id_fkey 
  FOREIGN KEY (template_id) REFERENCES business_templates(id) ON DELETE CASCADE;

-- template_usage -> business_templates (CASCADE)
ALTER TABLE template_usage DROP CONSTRAINT IF EXISTS template_usage_template_id_fkey;
ALTER TABLE template_usage ADD CONSTRAINT template_usage_template_id_fkey 
  FOREIGN KEY (template_id) REFERENCES business_templates(id) ON DELETE CASCADE;

-- shared_ai_knowledge -> businesses (SET NULL since we want to keep shared knowledge)
ALTER TABLE shared_ai_knowledge DROP CONSTRAINT IF EXISTS shared_ai_knowledge_contributor_id_fkey;
ALTER TABLE shared_ai_knowledge ADD CONSTRAINT shared_ai_knowledge_contributor_id_fkey 
  FOREIGN KEY (contributor_id) REFERENCES businesses(id) ON DELETE SET NULL;

-- Add business_metrics table if it doesn't exist (mentioned in the AI cofounder migration)
CREATE TABLE IF NOT EXISTS business_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  revenue DECIMAL(10,2) DEFAULT 0,
  customers INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5,2) DEFAULT 0,
  avg_order_value DECIMAL(10,2) DEFAULT 0,
  traffic INTEGER DEFAULT 0,
  metrics JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for business_metrics if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_business_metrics_business ON business_metrics(business_id, created_at DESC);

-- Grant permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
