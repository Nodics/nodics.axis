import { Button, Divider, Stack, Typography } from '@mui/material';

import type { AssistantPresentationState } from '../../../../assistant/presentation/assistantPresentationContracts';

interface AssistantConversationHistoryProps {
  readonly state: AssistantPresentationState;
  readonly historyLabel: string;
  readonly newConversationLabel: string;
  readonly noConversationsLabel: string;
  readonly loadMoreLabel: string;
  readonly onSelect: (conversationCode: string) => Promise<void>;
  readonly onNew: () => void;
  readonly onLoadMore: () => Promise<void>;
}

export function AssistantConversationHistory(props: AssistantConversationHistoryProps) {
  const busy = ['SUBMITTING', 'STREAMING', 'CANCELLING'].includes(props.state.status);
  return (
    <Stack
      component="nav"
      aria-label={props.historyLabel}
      spacing={1}
      sx={{
        background:
          'linear-gradient(180deg, rgba(248, 250, 252, 0.98), rgba(241, 245, 249, 0.82))',
        borderBottom: { xs: '1px solid', md: 0 },
        borderColor: 'divider',
        borderRight: { xs: 0, md: '1px solid' },
        maxHeight: { xs: 180, md: 'none' },
        maxWidth: { md: 420 },
        minWidth: { xs: 0, md: 220 },
        overflow: 'auto',
        p: 2,
        position: 'relative',
        resize: { xs: 'none', md: 'horizontal' },
        width: { xs: 'auto', md: 'clamp(240px, 24vw, 340px)' },
        '&::after': {
          bgcolor: 'divider',
          borderRadius: 4,
          content: '""',
          display: { xs: 'none', md: 'block' },
          height: 42,
          opacity: 0.75,
          position: 'absolute',
          right: 3,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 3,
        },
      }}
    >
      <Typography component="h2" sx={{ fontWeight: 700 }} variant="subtitle1">
        {props.historyLabel}
      </Typography>
      <Button
        disabled={busy}
        fullWidth
        sx={{ borderRadius: 2, minHeight: 44 }}
        variant="outlined"
        onClick={props.onNew}
      >
        {props.newConversationLabel}
      </Button>
      <Divider />
      {props.state.availableConversations.length ? (
        <>
          {props.state.availableConversations.map((conversation) => (
            <Button
              key={conversation.conversationCode}
              aria-current={
                props.state.activeConversationCode === conversation.conversationCode
                  ? 'page'
                  : undefined
              }
              color="secondary"
              disabled={busy || props.state.historyLoading}
              sx={{
                borderRadius: 2,
                justifyContent: 'flex-start',
                minHeight: 44,
                overflow: 'hidden',
                px: 1.5,
                textAlign: 'start',
                textOverflow: 'ellipsis',
                textTransform: 'none',
                whiteSpace: 'nowrap',
              }}
              variant={
                props.state.activeConversationCode === conversation.conversationCode
                  ? 'contained'
                  : 'text'
              }
              onClick={() => void props.onSelect(conversation.conversationCode)}
            >
              {conversation.title ?? props.newConversationLabel}
            </Button>
          ))}
          {props.state.conversationsHaveMore ? (
            <Button
              disabled={busy}
              size="small"
              onClick={() => void props.onLoadMore()}
            >
              {props.loadMoreLabel}
            </Button>
          ) : null}
        </>
      ) : (
        <Typography color="text.secondary" variant="body2">
          {props.noConversationsLabel}
        </Typography>
      )}
    </Stack>
  );
}
