import WidgetKit
import SwiftUI
import AppIntents

// MARK: - Data Model

struct QueueWidgetItem: Codable, Identifiable {
    var id: String { nodeId ?? text }
    let text: String
    let checked: Bool
    let type: String
    let nodeId: String?
    let deadline: String?
    let priority: String?
}

// MARK: - Timeline Provider

struct QueueTimelineProvider: TimelineProvider {
    func placeholder(in context: Context) -> QueueEntry {
        QueueEntry(date: Date(), items: [
            QueueWidgetItem(text: "Sample item", checked: false, type: "temp", nodeId: nil, deadline: nil, priority: nil)
        ])
    }

    func getSnapshot(in context: Context, completion: @escaping (QueueEntry) -> Void) {
        completion(QueueEntry(date: Date(), items: loadItems()))
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<QueueEntry>) -> Void) {
        let entry = QueueEntry(date: Date(), items: loadItems())
        let nextUpdate = Calendar.current.date(byAdding: .minute, value: 30, to: Date())!
        completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
    }

    private func loadItems() -> [QueueWidgetItem] {
        // Try App Group UserDefaults
        if let defaults = UserDefaults(suiteName: "group.zenica.treenotequeue"),
           let jsonString = defaults.string(forKey: "queueSnapshot"),
           let data = jsonString.data(using: .utf8),
           let items = try? JSONDecoder().decode([QueueWidgetItem].self, from: data),
           !items.isEmpty {
            return items
        }

        // Try file in App Group container
        if let containerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.zenica.treenotequeue") {
            let fileURL = containerURL.appendingPathComponent("queueSnapshot.json")
            if let data = try? Data(contentsOf: fileURL),
               let items = try? JSONDecoder().decode([QueueWidgetItem].self, from: data),
               !items.isEmpty {
                return items
            }
        }

        // Example data when no real data is available
        return [
            QueueWidgetItem(text: "Review project proposal", checked: false, type: "temp", nodeId: nil, deadline: "2026-04-01", priority: "high"),
            QueueWidgetItem(text: "Buy groceries", checked: false, type: "temp", nodeId: nil, deadline: nil, priority: nil),
            QueueWidgetItem(text: "Call dentist", checked: true, type: "temp", nodeId: nil, deadline: "2026-03-28", priority: "medium"),
            QueueWidgetItem(text: "Fix login bug", checked: false, type: "ref", nodeId: nil, deadline: nil, priority: "high"),
            QueueWidgetItem(text: "Weekly review", checked: false, type: "temp", nodeId: nil, deadline: nil, priority: nil),
        ]
    }
}

// MARK: - Timeline Entry

struct QueueEntry: TimelineEntry {
    let date: Date
    let items: [QueueWidgetItem]
}

// MARK: - Check Off Intent

struct CheckOffIntent: AppIntent {
    static var title: LocalizedStringResource = "Check Off Queue Item"

    @Parameter(title: "Item Index")
    var itemIndex: Int

    init() {}
    init(index: Int) {
        self.itemIndex = index
    }

    func perform() async throws -> some IntentResult {
        guard let defaults = UserDefaults(suiteName: "group.zenica.treenotequeue"),
              let jsonString = defaults.string(forKey: "queueSnapshot"),
              let data = jsonString.data(using: .utf8),
              var items = try? JSONDecoder().decode([QueueWidgetItem].self, from: data),
              itemIndex >= 0 && itemIndex < items.count
        else { return .result() }

        let item = items[itemIndex]
        items[itemIndex] = QueueWidgetItem(
            text: item.text, checked: !item.checked, type: item.type,
            nodeId: item.nodeId, deadline: item.deadline, priority: item.priority
        )

        if let encoded = try? JSONEncoder().encode(items),
           let str = String(data: encoded, encoding: .utf8) {
            defaults.set(str, forKey: "queueSnapshot")
        }

        WidgetCenter.shared.reloadAllTimelines()
        return .result()
    }
}

// MARK: - Widget Views

struct QueueWidgetEntryView: View {
    var entry: QueueEntry
    @Environment(\.widgetFamily) var family

    var body: some View {
        if entry.items.isEmpty {
            VStack(spacing: 6) {
                Image(systemName: "tray")
                    .font(.title2)
                    .foregroundStyle(.secondary)
                Text("Queue empty")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .containerBackground(.fill.tertiary, for: .widget)
        } else {
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text("QUEUE")
                        .font(.caption2)
                        .fontWeight(.semibold)
                        .tracking(1)
                        .foregroundStyle(.secondary)
                    Spacer()
                    Text("\(entry.items.filter { !$0.checked }.count) left")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                .padding(.bottom, 2)

                let maxItems = family == .systemMedium ? 5 : 3
                ForEach(Array(entry.items.prefix(maxItems).enumerated()), id: \.element.id) { index, item in
                    HStack(spacing: 8) {
                        Button(intent: CheckOffIntent(index: index)) {
                            Image(systemName: item.checked ? "checkmark.circle.fill" : "circle")
                                .font(.system(size: 16))
                                .foregroundStyle(item.checked ? .green : .secondary)
                        }
                        .buttonStyle(.plain)

                        Link(destination: URL(string: "treenotequeue://queue/\(index)")!) {
                            VStack(alignment: .leading, spacing: 1) {
                                Text(item.text.components(separatedBy: "\n").first?
                                    .replacingOccurrences(of: "# ", with: "") ?? item.text)
                                    .font(.caption)
                                    .fontWeight(item.checked ? .regular : .medium)
                                    .foregroundStyle(item.checked ? .secondary : .primary)
                                    .strikethrough(item.checked)
                                    .lineLimit(1)

                                if let deadline = item.deadline {
                                    Text(deadline)
                                        .font(.system(size: 9))
                                        .foregroundStyle(.orange)
                                }
                            }
                        }

                        Spacer()

                        if let priority = item.priority {
                            Text(priority)
                                .font(.system(size: 9))
                                .padding(.horizontal, 4)
                                .padding(.vertical, 2)
                                .background(priorityColor(priority).opacity(0.2))
                                .clipShape(Capsule())
                        }
                    }
                    .padding(.vertical, 1)
                }

                if entry.items.count > maxItems {
                    Text("+\(entry.items.count - maxItems) more")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .padding(.top, 2)
                }
            }
            .containerBackground(.fill.tertiary, for: .widget)
        }
    }

    private func priorityColor(_ priority: String) -> Color {
        switch priority {
        case "high": return .red
        case "medium": return .orange
        case "low": return .blue
        default: return .gray
        }
    }
}

// MARK: - Widget Configuration

struct TreenoteQueueWidget: Widget {
    let kind: String = "TreenoteQueueWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: QueueTimelineProvider()) { entry in
            QueueWidgetEntryView(entry: entry)
        }
        .configurationDisplayName("Treenote Queue")
        .description("View and check off your queue items.")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

@main
struct TreenoteWidgetBundle: WidgetBundle {
    var body: some Widget {
        TreenoteQueueWidget()
    }
}
