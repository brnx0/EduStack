export type Participant = {
  name: string;
  vote: string | null;
  hasVoted: boolean;
  connectedSockets: string[];
};

export type RoomState = {
  deck: string;
  participants: {
    [userId: string]: Participant;
  };
  revealed: boolean;
};
