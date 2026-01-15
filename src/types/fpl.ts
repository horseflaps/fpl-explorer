export interface ElementType {
    id: number;
    plural_name: string;
    plural_name_short: string;
    singular_name: string;
    singular_name_short: string;
}

export interface Fixture {
    id: number;
    code: number;
    team_h: number;
    team_h_score: number | null;
    team_a: number;
    team_a_score: number | null;
    event: number;
    finished: boolean;
    minutes: number;
    provisional_start_time: boolean;
    kickoff_time: string;
    event_name: string;
    is_home: boolean;
    difficulty: number;
}

export interface Team {
    id: number;
    code: number;
    name: string;
    short_name: string;
    strength: number;
    position: number;
    played: number;
    win: number;
    loss: number;
    draw: number;
    points: number;
    form: string | null;
    strength_overall_home: number;
    strength_overall_away: number;
    strength_attack_home: number;
    strength_attack_away: number;
    strength_defence_home: number;
    strength_defence_away: number;
}

export interface Player {
    id: number;
    code: number;
    first_name: string;

    second_name: string;
    web_name: string;
    team: number;
    element_type: number;
    selected_by_percent: string;
    now_cost: number;
    total_points: number;
    event_points: number;
    points_per_game: string;
    form: string;
    ep_next: string;
    ep_this: string;
    minutes: number;
    goals_scored: number;
    assists: number;
    clean_sheets: number;
    goals_conceded: number;
    own_goals: number;
    penalties_saved: number;
    penalties_missed: number;
    yellow_cards: number;
    red_cards: number;
    saves: number;
    bonus: number;
    bps: number;
    influence: string;
    creativity: string;
    threat: string;
    ict_index: string;
    expected_goals: string;
    expected_assists: string;
    photo: string;
    news: string;
    status: string;
}

export interface Event {
    id: number;
    name: string;
    deadline_time: string;
    is_current: boolean;
    is_next: boolean;
    is_previous: boolean;
    average_entry_score: number;
    highest_score: number;
}

export interface FPLResponse {
    events: Event[];
    game_settings: any;
    phases: any[];
    teams: Team[];
    total_players: number;
    elements: Player[]; // Players are called 'elements' in the API
    element_types: ElementType[];
}

export interface History {
    element: number;
    fixture: number;
    opponent_team: number;
    total_points: number;
    was_home: boolean;
    kickoff_time: string;
    team_h_score: number;
    team_a_score: number;
    round: number;
    minutes: number;
    goals_scored: number;
    assists: number;
    clean_sheets: number;
    goals_conceded: number;
    own_goals: number;
    penalties_saved: number;
    penalties_missed: number;
    yellow_cards: number;
    red_cards: number;
    saves: number;
    bonus: number;
    bps: number;
    influence: string;
    creativity: string;
    threat: string;
    ict_index: string;
    value: number;
    transfers_balance: number;
    selected: number;
    transfers_in: number;
    transfers_out: number;
}

export interface PlayerSummary {
    fixtures: any[];
    history: History[];
    history_past: any[];
}

export interface LeagueEntry {
    id: number;
    event_total: number;
    player_name: string;
    rank: number;
    last_rank: number;
    rank_sort: number;
    total: number;
    entry: number;
    entry_name: string;
}

export interface LeagueStandingsResponse {
    league: {
        id: number;
        name: string;
    };
    standings: {
        has_next: boolean;
        page: number;
        results: LeagueEntry[];
    };
}

export interface Pick {
    element: number;
    position: number;
    multiplier: number;
    is_captain: boolean;
    is_vice_captain: boolean;
}

export interface EntryPicksResponse {
    active_chip: string | null;
    automatic_subs: any[];
    entry_history: {
        event: number;
        points: number;
        total_points: number;
        rank: number;
        rank_sort: number;
        overall_rank: number;
        event_transfers: number;
        event_transfers_cost: number;
        value: number;
    };
    picks: Pick[];
}

export interface LiveStats {
    minutes: number;
    goals_scored: number;
    assists: number;
    clean_sheets: number;
    goals_conceded: number;
    own_goals: number;
    penalties_saved: number;
    penalties_missed: number;
    yellow_cards: number;
    red_cards: number;
    saves: number;
    bonus: number;
    bps: number;
    total_points: number;
    in_dreamteam: boolean;
}

export interface LiveElement {
    id: number;
    stats: LiveStats;
    explain: any[];
}

export interface LiveEventResponse {
    elements: LiveElement[];
}
