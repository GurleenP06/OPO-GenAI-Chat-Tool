import { useState } from 'react';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';

interface FeedbackDialogProps {
  type: 'up' | 'down';
  onClose: () => void;
  onSubmit: (feedback: { type: 'up' | 'down'; selectedReason?: string; customFeedback?: string }) => void;
}

const positiveOptions = [
  'Accurate information',
  'Well-structured response', 
  'Helpful citations',
  'Clear explanations',
  'Comprehensive coverage',
  'Easy to understand'
];

const negativeOptions = [
  'Inaccurate information',
  'Poor structure',
  'Missing citations',
  'Unclear explanations', 
  'Incomplete coverage',
  'Hard to understand',
  'Irrelevant content',
  'Outdated information'
];

export function FeedbackDialog({ type, onClose, onSubmit }: FeedbackDialogProps) {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [customFeedback, setCustomFeedback] = useState('');
  const [isOtherSelected, setIsOtherSelected] = useState(false);

  const options = type === 'up' ? positiveOptions : negativeOptions;
  const title = type === 'up' ? 'What did you like about this response?' : 'What could be improved?';
  const description = type === 'up' 
    ? 'Please select what you found helpful about this AI response.'
    : 'Please help us understand how we can improve this response.';

  const handleSubmit = () => {
    onSubmit({
      type,
      selectedReason: isOtherSelected ? 'Other' : selectedReason || undefined,
      customFeedback: customFeedback.trim() || undefined
    });
  };

  const handleOptionClick = (option: string) => {
    setSelectedReason(option);
    setIsOtherSelected(false);
  };

  const handleOtherClick = () => {
    setIsOtherSelected(true);
    setSelectedReason(null);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {options.map((option) => (
              <Badge
                key={option}
                variant={selectedReason === option && !isOtherSelected ? 'default' : 'outline'}
                className="cursor-pointer p-2 text-center justify-center hover:bg-accent"
                onClick={() => handleOptionClick(option)}
              >
                {option}
              </Badge>
            ))}
            <Badge
              variant={isOtherSelected ? 'default' : 'outline'}
              className="cursor-pointer p-2 text-center justify-center hover:bg-accent col-span-2"
              onClick={handleOtherClick}
            >
              Other (specify)
            </Badge>
          </div>

          {(isOtherSelected || selectedReason) && (
            <div>
              <label className="text-sm font-medium mb-2 block">
                {isOtherSelected ? 'Please provide your feedback:' : 'Additional comments (optional):'}
              </label>
              <Textarea
                placeholder={isOtherSelected ? "Please describe your feedback..." : "Any additional thoughts..."}
                value={customFeedback}
                onChange={(e) => setCustomFeedback(e.target.value)}
                className="min-h-[80px]"
              />
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!selectedReason && !isOtherSelected}
            >
              Submit Feedback
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
