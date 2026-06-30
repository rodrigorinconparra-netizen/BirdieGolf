import {
  pgTable,
  pgEnum,
  serial,
  integer,
  real,
  text,
  boolean,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/* ----------------------------------------------------------------------------
 * Enums
 * ------------------------------------------------------------------------- */
export const roleEnum = pgEnum("role", ["superadmin", "player"]);
export const courseSourceEnum = pgEnum("course_source", ["api", "manual"]);
/** Tee box ("barra de salida") gender category. */
export const teeGenderEnum = pgEnum("tee_gender", ["men", "women", "any"]);

/** Result of the tee/approach shot relative to the target. */
export const directionEnum = pgEnum("shot_direction", [
  "hit", // on target / fairway / green
  "left",
  "right",
  "short",
  "long",
  "left_short",
  "left_long",
  "right_short",
  "right_long",
]);

export const puttBreakEnum = pgEnum("putt_break", [
  "straight",
  "left_to_right",
  "right_to_left",
]);
export const puttSlopeEnum = pgEnum("putt_slope", ["flat", "uphill", "downhill"]);

export const trainingCategoryEnum = pgEnum("training_category", [
  "driving",
  "approach",
  "short_game",
  "putting",
  "mental",
  "fitness",
  "other",
]);
export const trainingSourceEnum = pgEnum("training_source", ["self", "ai"]);
export const chatRoleEnum = pgEnum("chat_role", ["user", "assistant"]);
export const clubKindEnum = pgEnum("club_kind", [
  "wood",
  "hybrid",
  "iron",
  "wedge",
  "putter",
]);

/* ----------------------------------------------------------------------------
 * Users
 * ------------------------------------------------------------------------- */
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  // Unique display name (case-insensitive): enforced by the DB index
  // `users_name_lower_unique` on lower(name), plus a check in registerAction.
  name: text("name").notNull(),
  role: roleEnum("role").notNull().default("player"),
  handicap: real("handicap"),
  federationLicense: text("federation_license"), // RFEG license number for handicap sync
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** A user's set of clubs (their bag). */
export const clubs = pgTable("clubs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  kind: clubKindEnum("kind").notNull().default("iron"),
  position: integer("position").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/* ----------------------------------------------------------------------------
 * Courses & holes
 * ------------------------------------------------------------------------- */
export const courses = pgTable("courses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  city: text("city"),
  region: text("region"),
  country: text("country"),
  holesCount: integer("holes_count").notNull().default(18),
  par: integer("par"),
  source: courseSourceEnum("source").notNull().default("manual"),
  externalId: text("external_id"), // id from the public golf course API
  lat: real("lat"),
  lon: real("lon"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const holes = pgTable("holes", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  number: integer("number").notNull(),
  par: integer("par").notNull(),
  distanceMeters: integer("distance_meters"),
  strokeIndex: integer("stroke_index"),
});

/** A tee box ("barra de salida") of a course: Blancas, Amarillas, Azules, Rojas… */
export const courseTees = pgTable("course_tees", {
  id: serial("id").primaryKey(),
  courseId: integer("course_id")
    .notNull()
    .references(() => courses.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  color: text("color"), // css color / hex for the chip (e.g. #facc15)
  gender: teeGenderEnum("gender").notNull().default("any"),
  courseRating: real("course_rating"),
  slopeRating: integer("slope_rating"),
  position: integer("position").notNull().default(0),
});

/** Per-hole length of a tee box, in metres. */
export const teeHoleDistances = pgTable(
  "tee_hole_distances",
  {
    id: serial("id").primaryKey(),
    teeId: integer("tee_id")
      .notNull()
      .references(() => courseTees.id, { onDelete: "cascade" }),
    holeNumber: integer("hole_number").notNull(),
    meters: integer("meters"),
  },
  (t) => ({
    uniq: uniqueIndex("tee_hole_unique").on(t.teeId, t.holeNumber),
  }),
);

/* ----------------------------------------------------------------------------
 * Rounds — and per-hole / per-shot detail (the heart of the app)
 * ------------------------------------------------------------------------- */
export const rounds = pgTable("rounds", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  courseId: integer("course_id").references(() => courses.id, { onDelete: "set null" }),
  playedAt: timestamp("played_at").notNull().defaultNow(),
  tee: text("tee"), // tee name (display); see teeId for the linked tee box
  teeId: integer("tee_id"),
  weather: text("weather"),
  notes: text("notes"),
  totalStrokes: integer("total_strokes"),
  totalPutts: integer("total_putts"),
  aiAnalysis: text("ai_analysis"),
  aiAnalyzedAt: timestamp("ai_analyzed_at"),
  isPublic: boolean("is_public").notNull().default(false),
  publishedAt: timestamp("published_at"),
  // Whether followers have already been notified about this round (live rounds
  // notify on creation; past rounds notify once all holes are filled).
  notified: boolean("notified").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const roundHoles = pgTable("round_holes", {
  id: serial("id").primaryKey(),
  roundId: integer("round_id")
    .notNull()
    .references(() => rounds.id, { onDelete: "cascade" }),
  holeNumber: integer("hole_number").notNull(),
  par: integer("par"),
  strokes: integer("strokes"),
  putts: integer("putts"),
  // Driving accuracy
  fairway: directionEnum("fairway"),
  // Approach / green in regulation
  greenInRegulation: boolean("green_in_regulation"),
  approachResult: directionEnum("approach_result"),
  approachDistanceMeters: integer("approach_distance_meters"),
  // Scrambling
  upAndDown: boolean("up_and_down"),
  sandSave: boolean("sand_save"),
  penalties: integer("penalties").notNull().default(0),
  // Per-shot detail
  teeClub: text("tee_club"),
  teeDistanceMeters: integer("tee_distance_meters"),
  approachClub: text("approach_club"),
  sand: boolean("sand"),
  firstPuttDistanceMeters: real("first_putt_distance_meters"),
  puttResult: directionEnum("putt_result"),
});

/**
 * Playing partners added to a round: each gets their own real round (partnerRoundId)
 * in their account, into which the creator records their per-hole total strokes.
 */
export const roundPlayers = pgTable(
  "round_players",
  {
    id: serial("id").primaryKey(),
    roundId: integer("round_id")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }), // the creator's round
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }), // the partner
    partnerRoundId: integer("partner_round_id").references(() => rounds.id, {
      onDelete: "set null",
    }), // the partner's own round
  },
  (t) => [uniqueIndex("round_players_unique").on(t.roundId, t.userId)],
);

/** Generic shot log (tee, approach, recovery, chips...). */
export const shots = pgTable("shots", {
  id: serial("id").primaryKey(),
  roundHoleId: integer("round_hole_id")
    .notNull()
    .references(() => roundHoles.id, { onDelete: "cascade" }),
  shotNumber: integer("shot_number").notNull(),
  club: text("club"),
  lie: text("lie"), // tee, fairway, rough, bunker, green...
  distanceToTargetMeters: integer("distance_to_target_meters"),
  result: directionEnum("result"),
  distanceRemainingMeters: integer("distance_remaining_meters"),
  notes: text("notes"),
});

/** High-detail putting log — where the user wants the most precision. */
export const putts = pgTable("putts", {
  id: serial("id").primaryKey(),
  roundHoleId: integer("round_hole_id")
    .notNull()
    .references(() => roundHoles.id, { onDelete: "cascade" }),
  puttNumber: integer("putt_number").notNull(),
  distanceMeters: real("distance_meters"),
  break: puttBreakEnum("break"),
  slope: puttSlopeEnum("slope"),
  made: boolean("made"),
  remainingCm: integer("remaining_cm"), // distance left if missed
});

/* ----------------------------------------------------------------------------
 * Training & AI recommendations
 * ------------------------------------------------------------------------- */
export const recommendations = pgTable("recommendations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  basedOn: text("based_on"), // short summary of the data that triggered it
  category: trainingCategoryEnum("category"),
  accepted: boolean("accepted").notNull().default(false),
  trainingId: integer("training_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const trainings = pgTable("trainings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  category: trainingCategoryEnum("category").notNull().default("other"),
  description: text("description"),
  goal: text("goal"),
  source: trainingSourceEnum("source").notNull().default("self"),
  recommendationId: integer("recommendation_id").references(
    () => recommendations.id,
  ),
  scheduledFor: timestamp("scheduled_for"),
  performedAt: timestamp("performed_at"),
  durationMinutes: integer("duration_minutes"),
  completed: boolean("completed").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/* ----------------------------------------------------------------------------
 * AI coach chat history
 * ------------------------------------------------------------------------- */
export const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: chatRoleEnum("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/* ----------------------------------------------------------------------------
 * Tournaments
 * ------------------------------------------------------------------------- */
export const tournamentVisibilityEnum = pgEnum("tournament_visibility", [
  "public",
  "private",
]);
export const tournamentFormatEnum = pgEnum("tournament_format", ["single", "league"]);
export const tournamentStartEnum = pgEnum("tournament_start", ["shotgun", "progressive"]);
export const tournamentStatusEnum = pgEnum("tournament_status", [
  "open",
  "live",
  "finished",
]);
export const tournamentPairingsEnum = pgEnum("tournament_pairings", ["auto", "manual"]);
/** Scoring format of a tournament/event. */
export const scoringFormatEnum = pgEnum("scoring_format", [
  "stroke", // Medal (golpes brutos)
  "stroke_net", // Medal neto (golpes − hándicap)
  "stableford", // Stableford (puntos brutos)
  "stableford_net", // Stableford neto
]);

export const tournaments = pgTable("tournaments", {
  id: serial("id").primaryKey(),
  // When set, this tournament is an event/jornada inside a league (the parent).
  parentId: integer("parent_id"),
  ownerId: integer("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  courseId: integer("course_id").references(() => courses.id, { onDelete: "set null" }),
  visibility: tournamentVisibilityEnum("visibility").notNull().default("public"),
  format: tournamentFormatEnum("format").notNull().default("single"),
  scoringFormat: scoringFormatEnum("scoring_format").notNull().default("stroke"),
  // Tee (barra) played — gives slope/course rating for the net handicap modalities.
  teeId: integer("tee_id").references(() => courseTees.id, { onDelete: "set null" }),
  startType: tournamentStartEnum("start_type").notNull().default("progressive"),
  intervalMinutes: integer("interval_minutes").notNull().default(10),
  playDate: timestamp("play_date"),
  inviteCode: text("invite_code").notNull().unique(),
  startsAt: timestamp("starts_at"),
  registrationDeadline: timestamp("registration_deadline"),
  pairingsMode: tournamentPairingsEnum("pairings_mode").notNull().default("auto"),
  pairingsPublishAt: timestamp("pairings_publish_at"),
  pairingsPublished: boolean("pairings_published").notNull().default(false),
  status: tournamentStatusEnum("status").notNull().default("open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const tournamentSlots = pgTable("tournament_slots", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id")
    .notNull()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  startTime: text("start_time").notNull(), // "09:30"
  label: text("label"),
  position: integer("position").notNull().default(0),
});

export const tournamentParticipants = pgTable(
  "tournament_participants",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    slotId: integer("slot_id").references(() => tournamentSlots.id, {
      onDelete: "set null",
    }),
    isOrganizer: boolean("is_organizer").notNull().default(false),
    roundId: integer("round_id").references(() => rounds.id, { onDelete: "set null" }),
    markerId: integer("marker_id"), // participant who marks this player's card
    groupId: integer("group_id"), // assigned partida (group)
    wantsDetail: boolean("wants_detail").notNull().default(false),
    signed: boolean("signed").notNull().default(false),
    signedAt: timestamp("signed_at"),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uniq_tournament_user").on(t.tournamentId, t.userId)],
);

/** A partida (group) within a turno: a tee time / starting hole and its players (via participant.groupId). */
export const tournamentGroups = pgTable("tournament_groups", {
  id: serial("id").primaryKey(),
  tournamentId: integer("tournament_id")
    .notNull()
    .references(() => tournaments.id, { onDelete: "cascade" }),
  slotId: integer("slot_id")
    .notNull()
    .references(() => tournamentSlots.id, { onDelete: "cascade" }),
  teeTime: text("tee_time"),
  startHole: integer("start_hole"),
  position: integer("position").notNull().default(0),
});

/** Per-player per-hole scores, with the player's own value and the marker's value (for verification). */
export const tournamentHoleScores = pgTable(
  "tournament_hole_scores",
  {
    id: serial("id").primaryKey(),
    tournamentId: integer("tournament_id")
      .notNull()
      .references(() => tournaments.id, { onDelete: "cascade" }),
    participantId: integer("participant_id")
      .notNull()
      .references(() => tournamentParticipants.id, { onDelete: "cascade" }),
    holeNumber: integer("hole_number").notNull(),
    par: integer("par"),
    selfStrokes: integer("self_strokes"),
    selfPutts: integer("self_putts"),
    markerStrokes: integer("marker_strokes"),
    // Optional full detail (same as a normal round), captured when "detalle" is on.
    fairway: directionEnum("fairway"),
    teeClub: text("tee_club"),
    teeDistanceMeters: integer("tee_distance_meters"),
    approachClub: text("approach_club"),
    approachDistanceMeters: integer("approach_distance_meters"),
    approachResult: directionEnum("approach_result"),
    sand: boolean("sand"),
    firstPuttDistanceMeters: real("first_putt_distance_meters"),
    puttResult: directionEnum("putt_result"),
    penalties: integer("penalties"),
  },
  (t) => [uniqueIndex("uniq_score_participant_hole").on(t.participantId, t.holeNumber)],
);

/* ----------------------------------------------------------------------------
 * Social: follows + notifications
 * ------------------------------------------------------------------------- */
export const follows = pgTable(
  "follows",
  {
    id: serial("id").primaryKey(),
    followerId: integer("follower_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    followingId: integer("following_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    notify: boolean("notify").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("uniq_follow").on(t.followerId, t.followingId)],
);

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  actorId: integer("actor_id").references(() => users.id, { onDelete: "cascade" }),
  roundId: integer("round_id").references(() => rounds.id, { onDelete: "cascade" }),
  tournamentId: integer("tournament_id").references(() => tournaments.id, {
    onDelete: "cascade",
  }),
  type: text("type").notNull(),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Native push tokens (FCM) per device, for sending push notifications. */
export const deviceTokens = pgTable(
  "device_tokens",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull(),
    platform: text("platform"), // ios | android | web
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("device_tokens_token_unique").on(t.token)],
);
