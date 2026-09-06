from pydantic import BaseModel


class AnalyticsOverviewResponse(BaseModel):
    total_conversations: int
    total_messages: int
    active_memories: int
    total_documents: int
    feedback_total: int
    positive_feedback: int
    negative_feedback: int
    positive_feedback_rate: float