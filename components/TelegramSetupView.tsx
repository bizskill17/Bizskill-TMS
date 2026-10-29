
import React from 'react';
import { Bot, Users, MessageSquare, Plus, Search, Info } from 'lucide-react';
import { useLabels } from '../labelOverrides';

export const TelegramSetupView: React.FC = () => {
  const { getViewLabel } = useLabels();
  const commonIconClass = "inline-flex items-center justify-center p-2 bg-indigo-50 rounded-full text-indigo-600 flex-shrink-0";
  const stepTitleClass = "font-semibold text-lg text-indigo-800"; // Removed block and mb-1 for inline usage
  const stepDescriptionClass = "text-sm text-gray-600 font-normal";

  return (
    <div className="space-y-8 pb-10 max-w-4xl mx-auto">
      <div className="flex flex-col gap-4">
        <div>
	          <h2 className="sr-only">{getViewLabel('telegram-setup', 'Telegram Group Setup')}</h2>
          <p className="text-sm text-gray-500 mt-1">
            Follow these steps to find your Telegram Group Chat ID for notifications.
          </p>
        </div>
      </div>

      <div className="bg-white p-6 md:p-8 rounded-xl shadow-lg border-2 border-indigo-200">
        {/* Removed the h3 "Steps to Create a Telegram Group Chat ID" as requested by the user */}

        <ol className="list-decimal list-outside space-y-6 text-gray-700 text-base pl-5"> {/* Standard ordered list with default padding */}
          {/* Step 1 */}
          <li className="flex items-start">
            <div className="flex-shrink-0 mr-3 mt-0.5"> {/* Container for icon, adds space to the right */}
              <span className={commonIconClass}><Plus size={20} /></span>
            </div>
            <div className="flex-1"> {/* This div takes up remaining space and wraps title/description */}
              <strong className={stepTitleClass}>Create the Group:</strong>
              <p className="mt-1 {stepDescriptionClass}">
                Start by creating a new private or public group in Telegram where you want to receive notifications.
              </p>
            </div>
          </li>

          {/* Step 2 */}
          <li className="flex items-start">
            <div className="flex-shrink-0 mr-3 mt-0.5">
              <span className={commonIconClass}><Users size={20} /></span>
            </div>
            <div className="flex-1">
              <strong className={stepTitleClass}>Add Members:</strong>
              <p className="mt-1 {stepDescriptionClass}">
                Add all relevant team members who should receive TaskPro notifications for this group.
              </p>
            </div>
          </li>

          {/* Step 3 */}
          <li className="flex items-start">
            <div className="flex-shrink-0 mr-3 mt-0.5">
              <span className={commonIconClass}><Search size={20} /></span>
            </div>
            <div className="flex-1">
              <strong className={stepTitleClass}>Search for an ID Bot:</strong>
              <p className="mt-1 {stepDescriptionClass}">
                In Telegram's search bar, look for a bot that finds Chat IDs (e.g., <code className="font-mono text-indigo-700 bg-indigo-50 p-1 rounded">@getidsbot</code> or <code className="font-mono text-indigo-700 bg-indigo-50 p-1 rounded">@userinfobot</code>).
              </p>
            </div>
          </li>

          {/* Step 4 */}
          <li className="flex items-start">
            <div className="flex-shrink-0 mr-3 mt-0.5">
              <span className={commonIconClass}><MessageSquare size={20} /></span>
            </div>
            <div className="flex-1">
              <strong className={stepTitleClass}>Add the Bot to Your Group:</strong>
              <p className="mt-1 {stepDescriptionClass}">
                Go to your newly created group's details screen, tap "Add Member", and search for the ID bot's username (e.g., <code className="font-mono text-indigo-700 bg-indigo-50 p-1 rounded">@getidsbot</code>) and add it to your group.
              </p>
            </div>
          </li>

          {/* Step 5 */}
          <li className="flex items-start">
            <div className="flex-shrink-0 mr-3 mt-0.5">
              <span className={commonIconClass}><Info size={20} /></span>
            </div>
            <div className="flex-1">
              <strong className={stepTitleClass}>Retrieve Your Chat ID:</strong>
              <p className="mt-1 {stepDescriptionClass}">
                Send any message (e.g., "hello" or "/start") into your group. The ID bot will immediately reply with information, and the <strong>negative number</strong> it shows will be your unique Chat ID. Copy this ID and paste it into the "Settings" page for the relevant project or office group.
              </p>
            </div>
          </li>
        </ol>
      </div>

      <div className="p-4 md:p-6 bg-yellow-50 rounded-xl border-2 border-yellow-300 text-yellow-800 flex items-start gap-4">
        <Info size={20} className="flex-shrink-0 text-yellow-600 mt-1" />
        <p className="text-sm font-medium">
          <strong>Important:</strong> Telegram Group Chat IDs are typically negative numbers. Make sure to copy the entire number, including the minus sign.
        </p>
      </div>
    </div>
  );
};
