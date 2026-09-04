-- Seeds the 12-dimension tagging taxonomy. See docs/phase-1-prd.md §4.
-- `topic` is intentionally absent — it's open-vocabulary, not a fixed enum.

insert into taxonomy (dimension, value, definition) values
  ('hook_modality','face','Opens on someone talking directly to camera'),
  ('hook_modality','voiceover','Opens with narration over footage, no face to camera'),
  ('hook_modality','text','On-screen text carries the hook, no speech'),
  ('hook_modality','motion','Pure action/B-roll opens the video, no dialogue or text'),

  ('hook_type','curiosity_gap','Withholds information to create a question the viewer wants answered'),
  ('hook_type','bold_claim','Opens with a strong, specific assertion'),
  ('hook_type','relatable_problem','Names a problem the viewer recognizes in themselves'),
  ('hook_type','how_to_promise','States the payoff/skill the video will deliver'),
  ('hook_type','story_open','Opens mid-narrative, "this happened to me"'),
  ('hook_type','stat_shock','Leads with a surprising number or fact'),
  ('hook_type','pattern_interrupt','Visually or verbally breaks expectation to stop the scroll'),
  ('hook_type','direct_cta','Opens by telling the viewer what to do'),

  ('format','talking_head','Person speaking to camera, minimal cutaways'),
  ('format','vlog','Follows a real activity/day as it happens'),
  ('format','tutorial','Step-by-step instructional structure'),
  ('format','listicle','Enumerated list structure ("3 things...")'),
  ('format','pov_skit','Staged point-of-view scenario'),
  ('format','cinematic_montage','Music-driven visual sequence, little/no dialogue'),
  ('format','challenge','A defined challenge or stunt structure'),
  ('format','qna','Answering a specific question or comment'),

  ('length_bucket','under_15s','Under 15 seconds'),
  ('length_bucket','15_30s','15 to 30 seconds'),
  ('length_bucket','30_60s','30 to 60 seconds'),
  ('length_bucket','over_60s','Over 60 seconds'),

  ('audio_type','trending_sound','Uses a currently-trending audio track'),
  ('audio_type','original_sound','Uses the creator''s own original audio'),
  ('audio_type','licensed_music','Uses a specific, non-trending licensed track'),
  ('audio_type','voiceover_only','No music bed, voiceover carries the audio'),
  ('audio_type','ambient_sync','Natural/ambient sound only, no added track'),

  ('onscreen_text_density','none','No burned-in text'),
  ('onscreen_text_density','light','Title or CTA text only'),
  ('onscreen_text_density','heavy','Captions or lists run throughout'),

  ('first_frame_kind','face','A face is the first thing shown'),
  ('first_frame_kind','text_hook','Text is the first thing shown'),
  ('first_frame_kind','action_shot','Motion/action is the first thing shown'),
  ('first_frame_kind','landscape','A wide/establishing shot opens the video'),
  ('first_frame_kind','product','A product or object is the first thing shown'),

  ('location_type','urban','City street or built environment'),
  ('location_type','trail','Off-road/trail setting'),
  ('location_type','road','On-road cycling setting'),
  ('location_type','home','Home or indoor personal setting'),
  ('location_type','event','A race, event, or organized ride'),
  ('location_type','studio','A controlled/studio setting'),

  ('cta_type','follow_explicit','Directly asks the viewer to follow'),
  ('cta_type','comment_prompt','Asks the viewer to comment'),
  ('cta_type','save_prompt','Asks the viewer to save the post'),
  ('cta_type','share_prompt','Asks the viewer to share the post'),
  ('cta_type','link_bio','Points the viewer to the link in bio'),
  ('cta_type','none','No explicit call to action')
on conflict (dimension, value) do nothing;
