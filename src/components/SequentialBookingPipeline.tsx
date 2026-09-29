import React from 'react';
import { DynamicSchemaWorkflow } from './DynamicSchemaWorkflow';
import { WebookEvent, Seat, TicketTier, Account } from '../types/bot';

interface SequentialBookingPipelineProps {
  events: WebookEvent[];
  currentEvent: WebookEvent;
  onSelectEvent: (event: WebookEvent) => void;
  selectedSeats: Seat[];
  onToggleSeat: (seat: Seat) => void;
  accounts: Account[];
  onUpdateEventTiers?: (tiers: TicketTier[], seatingMap: any) => void;
}

/**
 * SequentialBookingPipeline is now powered dynamically by DynamicSchemaWorkflow,
 * eliminating the static hardcoded 5-step UI pipeline and driving steps, inputs,
 * and payloads entirely from the live JSON schema returned by the official API.
 */
export const SequentialBookingPipeline: React.FC<SequentialBookingPipelineProps> = (props) => {
  return <DynamicSchemaWorkflow {...props} />;
};

export default SequentialBookingPipeline;
