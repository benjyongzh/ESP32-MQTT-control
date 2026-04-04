import { ComponentProps } from "react";
import { Info } from "lucide-react";

import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

type ConfigLabelProps = {
  htmlFor?: string;
  label: string;
  tooltip?: string;
};

export function ConfigLabel(props: ConfigLabelProps) {
  const { htmlFor, label, tooltip } = props;

  return (
    <div className="flex items-center gap-1">
      <Label htmlFor={htmlFor}>{label}</Label>
      {tooltip ? (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground inline-flex h-4 w-4 items-center justify-center"
              aria-label={`${label} info`}
            >
              <Info className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            sideOffset={6}
            align="center"
            className="w-64 p-3 text-sm"
          >
            <p className="text-muted-foreground leading-snug">{tooltip}</p>
          </PopoverContent>
        </Popover>
      ) : null}
    </div>
  );
}

type ConfigInputFieldProps = {
  error?: string;
  label: string;
  tooltip?: string;
} & ComponentProps<typeof Input>;

export default function ConfigInputField(props: ConfigInputFieldProps) {
  const { error, id, label, tooltip, ...inputProps } = props;

  return (
    <div className="flex flex-col gap-1">
      <ConfigLabel htmlFor={id} label={label} tooltip={tooltip} />
      <Input id={id} {...inputProps} />
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
