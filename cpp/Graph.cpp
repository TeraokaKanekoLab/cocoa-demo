#include "Graph.h"

Graph::Graph(string input_data_dir, bool with_no_edge) {
    data_dir = input_data_dir;
    char splitter = ' ';
    srand((unsigned int)time(NULL));
    
    _load_attribute();

    adj_list_list = vector<vector<int>>(n, vector<int>());
    adj_set_list = vector<unordered_set<int>>(n, unordered_set<int>());
    if (with_no_edge) return;
    else if (is_weighted) {
        return;
    } else {
        string graph_binary_path = string(getenv("HOME")) + "/graph_binary/" + data_dir + "/adj_list_list.bin";
        ifstream ifs(graph_binary_path);
        bool binary_exists = ifs.good();
        if (binary_exists) {
            cout << "load from binary" << endl;
            load_graph_from_binary();
        } else {
            cout << "load from txt" << endl;
            vector<pair<int, int>> edge_list = load_edge_list();
            for (pair<int, int> edge : edge_list) {
                int src_id = edge.first;
                int dst_id = edge.second;
                if (src_id == dst_id) continue; // ignore self-loop
                int insert_count = insert_edge(src_id, dst_id);
                assert(insert_count > 0);
            }
        }
        return;
    }
}

// int Graph::node_size() const {
//     return n;
// }

int Graph::edge_size() const {
    int edge_count = 0;
    // for ( itr = nodes.begin(); itr != nodes.end(); itr++) edge_count += (*itr).get_adj_num();
    for (int node_id = 0; node_id < n; node_id++) edge_count += get_adj_num(node_id);
    if (!is_directed) edge_count /= 2;
    return edge_count;
}

// Node* Graph::get_node(int node_id) {
//     return &(nodes.at(node_id));
// }

int Graph::get_random_adjacent(int node_id) const {
    vector<int> adj_list = adj_list_list.at(node_id);
    int degree = adj_list.size();
    if (degree == 0) return -1;
    else return adj_list.at((int)(rand() % degree));
}

// path.back() == -1 は dangling node で強制終了した path を表現
void Graph::get_paths(int src_id, int walk_count, double alpha, vector<vector<int>>& paths) const {
    // const Node* src_node;
    // src_node = &(nodes.at(src_id));
    for (int i = 0; i < walk_count; i++) {
        vector<int> path;
        // const Node* current_node = src_node;
        int current_node_id = src_id;
        // Node* next_node;
        int next_node_id;
        bool is_dangling = false;
        do {
            if (is_dangling) {
                path.push_back(-1);
                break;
            }
            path.push_back(current_node_id);
            next_node_id = get_random_adjacent(current_node_id);
            if (next_node_id == -1) is_dangling = true;
            else current_node_id = next_node_id;
        } while ((double)rand()/RAND_MAX > alpha);
        
        paths.push_back(path);
    }
    return;
}

void Graph::get_paths_longer_than_1(int src_id, int walk_count, double alpha, vector<vector<int>>& paths) const {
    for (int i = 0; i < walk_count; i++) {
        vector<int> path;
        path.push_back(src_id);
        int current_node_id = src_id;
        do {
            current_node_id = get_random_adjacent(current_node_id);
            path.push_back(current_node_id);
            if (current_node_id == -1) break;
        } while ((double)rand()/RAND_MAX > alpha);
        
        paths.push_back(path);
    }
    return;
}

struct WalkerMeta {
    int id_;
    int source_;
    int current_;
};

struct BufferSlot {
    bool empty_;
    WalkerMeta w_;
    int64_t r_;
    double dr_;
};

void Graph::get_paths_by_thunder_rw(int source_id, int walk_count, double alpha, vector<vector<int>>& paths, const vector<int>& degree_vec) const {
    vector<WalkerMeta> walkers;

    sfmt_t sfmt;
    sfmt_init_gen_rand(&sfmt, 0);

    walkers.reserve(2048);
    for (int i = 0; i < walk_count; ++i) {
        walkers.push_back({i, source_id, source_id});
    }
    paths.resize(walk_count);
    for (int i = 0; i < walk_count; i++) {
        paths.at(i).push_back(source_id);
    }

    int next = 0;
    int num_completed_walkers = 0;
    int ring_size = 64;
    BufferSlot r[ring_size];

    for (int i = 0; i < ring_size; ++i) {
        r[i].empty_ = false;
        r[i].w_ = walkers[next];
        next += 1;
    }

    while (num_completed_walkers < walk_count) {
        for (int i = 0; i < ring_size; ++i) {
            BufferSlot& slot = r[i];
            if (!slot.empty_) {
                // Update the status of the walker.
                if (sfmt_genrand_real1(&sfmt) <= alpha) {
                    // If the walker completes, then set the slot as empty.
                    slot.empty_ = true;
                    num_completed_walkers += 1;
                }
            }

            // If the slot is empty, then add a new walker to the ring buffer.
            if (slot.empty_) {
                if (next < walk_count) {
                    slot.empty_ = false;
                    slot.w_ = walkers[next++];
                }
            }
        }

        // Stage 1: generate random number & prefetch the degree.
        for (int i = 0; i < ring_size; ++i) {
            BufferSlot& slot = r[i];
            if (!slot.empty_) {
                slot.r_ = sfmt_genrand_uint32(&sfmt);
                _mm_prefetch((void*)(degree_vec.data() + slot.w_.current_), PREFETCH_HINT);
            }
        }

        // Stage 2: generate the position & prefetch the neighbor.
        for (int i = 0; i < ring_size; ++i) {
            BufferSlot& slot = r[i];
            if (!slot.empty_) {
                int degree = degree_vec[slot.w_.current_];
                if (degree == 0) {
                    paths.at(slot.w_.id_).push_back(-1);
                    slot.empty_ = true;
                    num_completed_walkers += 1;
                } else {
                    slot.r_ = slot.r_ % degree;
                    _mm_prefetch((void*)(adj_list_list[slot.w_.current_].data() + slot.r_), PREFETCH_HINT);
                }
            }
        }

        // Stage 3: update the walker.
        for (int i = 0; i < ring_size; ++i) {
            BufferSlot& slot = r[i];
            if (!slot.empty_) {
                slot.w_.current_ = adj_list_list[slot.w_.current_][slot.r_];
                paths.at(slot.w_.id_).push_back(slot.w_.current_);
            }
        }
    }

    return;
}

// path.back() == -1 は dangling node で強制終了した path を表現
vector<int> Graph::get_random_walk_end_nodes(int src_id, int walk_count, double alpha) const {
    vector<int> end_node_id_list;
    for (int i = 0; i < walk_count; i++) {
        int current_node_id = src_id;
        while ((double)rand()/RAND_MAX > alpha) {
            if (current_node_id == -1) break;
            current_node_id = get_random_adjacent(current_node_id);
        }
        end_node_id_list.push_back(current_node_id);
    }
    return end_node_id_list;
}

map<int, double> Graph::calc_ppr_by_rw(int src_id, int walk_count, double alpha) const {
    vector<vector<int>> paths;
    get_paths(src_id, walk_count, alpha, paths);
    assert(paths.size() == walk_count);
    map<int, double> ppr;
    for (int i = 0; i < walk_count; i++) {
        vector<int> path = paths[i];
        int end_node_id = path.back();
        if (ppr.count(end_node_id) == 0) ppr.emplace(end_node_id, 0.0);
        ppr[end_node_id] += 1.0 / walk_count;
    }
    return ppr;
}

pair<map<int, double>, map<int, double>> Graph::calc_ppr_by_fp(const map<int, double>& src_map, int walk_count, double alpha) const {
    map<int, double> normalized_src_map = get_normalized_map(src_map);
    map<int, double> residue, ppr;
    set<int> active_node_set;
    queue<int> active_node_queue;
    for (const auto&[node_id, val] : normalized_src_map) {
        residue.emplace(node_id, val);
        active_node_set.insert(node_id);
        active_node_queue.push(node_id);
    }

    while (active_node_queue.size() > 0) {
        int node_id = active_node_queue.front();
        int node_degree = get_adj_num(node_id);
        active_node_queue.pop();
        active_node_set.erase(node_id);
        // if (ppr.count(node_id) == 0) ppr.emplace(node_id, 0);
        // dangling node 到達時はスーパーノード-1に渡す．スーパーノードはactive node 対象外
        if (node_degree == 0) {
            ppr[node_id] += alpha * residue.at(node_id);
            // if (ppr.count(-1) == 0) ppr.emplace(-1, 0.0);
            ppr[-1] += (1 - alpha) * residue.at(node_id);
        } else {
            vector<int> adj_list = get_adj_list(node_id);
            for (int i = 0; i < node_degree; i++) {
                int adj_id = adj_list[i];
                int adj_degree = get_adj_num(adj_id);
                // if (residue.count(adj_id) == 0) residue.emplace(adj_id, 0);
                residue[adj_id] += (1 - alpha) * residue.at(node_id) / node_degree;
                if ((residue.at(adj_id) > r_max_func(adj_degree, alpha, walk_count)) && (active_node_set.count(adj_id) == 0)) {
                    active_node_set.insert(adj_id);
                    active_node_queue.push(adj_id);
                }
            }
            ppr[node_id] += alpha * residue.at(node_id);
        }
        residue[node_id] = 0;
    }

    return make_pair(ppr, residue);
}

map<int, double> Graph::calc_ppr_by_fora(int src_id, int walk_count, double alpha) const {
    map<int, double> src_map{{src_id, 1}};
    return calc_ppr_by_fora(src_map, walk_count, alpha);
}

map<int, double> Graph::calc_ppr_by_fora(const map<int, double>& src_map, int walk_count, double alpha) const {
    map<int, double> normalized_src_map = get_normalized_map(src_map);
    pair<map<int, double>, map<int, double>> tmp = calc_ppr_by_fp(src_map, walk_count, alpha);
    map<int, double> ppr = tmp.first;
    map<int, double> residue = tmp.second;

    for (auto itr = residue.begin(); itr != residue.end(); itr++) {
        int node_id = itr->first;
        double r_val = itr->second;
        if (r_val == 0) continue;
        
        int walk_count_i = (int)ceil(r_val * walk_count);
        vector<int> end_node_id_list = get_random_walk_end_nodes(node_id, walk_count_i, alpha);
        for (int end_node_id : end_node_id_list) {
            if (ppr.count(end_node_id) == 0) ppr[end_node_id] = 0;
            ppr[end_node_id] += (double)r_val / walk_count_i;
        }
    }
    return ppr;
}

pair<map<int, double>, map<int, double>> Graph::calc_ppr_by_fp_full_path(const map<int, double>& src_map, int walk_count, double alpha, double& total_step) const {
    map<int, double> normalized_src_map = get_normalized_map(src_map);
    map<int, double> residue, ppr;
    set<int> active_node_set;
    queue<int> active_node_queue;
    for (const auto&[node_id, val] : normalized_src_map) {
        double walk_amount = (double)walk_count * val;
        residue.emplace(node_id, walk_amount);
        ppr.emplace(node_id, walk_amount);
        total_step += walk_amount;
        active_node_set.insert(node_id);
        active_node_queue.push(node_id);
    }
    while (active_node_queue.size() > 0) {
        int node_id = active_node_queue.front();
        int node_degree = get_adj_num(node_id);
        double residue_val = residue.at(node_id);
        residue[node_id] = 0;
        active_node_queue.pop();
        active_node_set.erase(node_id);
        // if (ppr.count(node_id) == 0) ppr.emplace(node_id, 0);
        // dangling node 到達時はスーパーノード-1に渡す．スーパーノードはactive node 対象外
        if (node_degree == 0) {
            // if (ppr.count(-1) == 0) ppr.emplace(-1, 0.0);
            ppr[-1] += (1 - alpha) * residue_val;
            total_step += (1 - alpha) * residue_val;
        } else {
            double move_walker_val = (1 - alpha) * residue_val / node_degree;
            for (int adj_id : get_adj_list(node_id)) {
                // if (residue.count(adj_id) == 0) residue.emplace(adj_id, 0);
                residue[adj_id] += move_walker_val;
                ppr[adj_id] += move_walker_val;
                total_step += move_walker_val;
                int adj_degree = get_adj_num(adj_id);
                if ((residue.at(adj_id) > (double)adj_degree / alpha) && (active_node_set.count(adj_id) == 0)) {
                    active_node_set.insert(adj_id);
                    active_node_queue.push(adj_id);
                }
            }
        }
    }

    return make_pair(ppr, residue);
}

map<int, double> Graph::calc_ppr_by_fora_full_path(const map<int, double>& src_map, int walk_count, double alpha) const {
    double total_step = 0.0;
    map<int, double> normalized_src_map = get_normalized_map(src_map);
    pair<map<int, double>, map<int, double>> tmp = calc_ppr_by_fp_full_path(src_map, walk_count, alpha, total_step);
    assert(total_step > 0);
    map<int, double> ppr = tmp.first;
    map<int, double> residue = tmp.second;

    for (auto itr = residue.begin(); itr != residue.end(); itr++) {
        int node_id = itr->first;
        double r_val = itr->second;
        if (r_val == 0) continue;
        
        int walk_count_i = (int)ceil(r_val);
        double walk_weight = (double)r_val / walk_count_i;
        vector<vector<int>> path_list;
        get_paths(node_id, walk_count_i, alpha, path_list);
        for (vector<int> path : path_list) {
            for (int through_node_id : path) {
                // if (ppr.count(through_node_id) == 0) ppr[end_node_id] = 0;
                ppr[through_node_id] += walk_weight;
                total_step += walk_weight;
            }
        }
        ppr[node_id] -= walk_weight * walk_count_i;
    }

    for (auto&[node_id, ppr_val] : ppr) {
        ppr[node_id] = (double)ppr_val / total_step;
    }
    return ppr;
}

map<int, double> Graph::calc_ppr_by_fora_full_path(int src_id, int walk_count, double alpha) const {
    map<int, double> src_map{{src_id, 1}};
    return calc_ppr_by_fora_full_path(src_map, walk_count, alpha);
}

vector<double> Graph::calc_pagerank_by_power_iteration(double alpha, double epsilon) const {
    double tmp_sum = 0;
    vector<double> pr(n, 0);
    for (int i = 0; i < n; i++) {
        double tmp = (double)rand()/RAND_MAX;
        tmp_sum += tmp;
        pr[i] = tmp;
    }
    for (int node_id = 0; node_id < n; node_id++) 
        pr[node_id] = pr.at(node_id) / tmp_sum;

    double l1_norm;
    do {
        vector<double> new_pr(n, 0);
        double jump_val = 0.0;
        for (int node_id = 0; node_id < n; node_id++) {
            // Node* node = &(nodes.at(node_id));
            int node_degree = get_adj_num(node_id);
            double pr_val = pr.at(node_id);
            if (node_degree == 0) {
                jump_val += pr_val;
            } else {
                vector<int> adj_list = get_adj_list(node_id);
                for (auto itr = adj_list.begin(); itr != adj_list.end(); itr++) {
                    int adj_id = *itr;
                    new_pr[adj_id] += pr_val * (1 - alpha) / node_degree;
                }
                jump_val += pr_val * alpha;
            }
        }
        for (int node_id = 0; node_id < n; node_id++) {
            new_pr[node_id] += jump_val / n;
        }

        l1_norm = 0;
        for (int node_id = 0; node_id < n; node_id++) {
            l1_norm += abs(pr[node_id] - new_pr[node_id]);
            pr[node_id] = new_pr[node_id];
        }
    } while (l1_norm > epsilon);
    return pr;
}

vector<double> Graph::calc_eigenvector_centrality_by_power_iteration(double epsilon) const {
    double tmp_sum = 0;
    vector<double> pr(n, 0);
    for (int i = 0; i < n; i++) {
        double tmp = (double)rand()/RAND_MAX;
        tmp_sum += tmp;
        pr[i] = tmp;
    }
    for (int node_id = 0; node_id < n; node_id++) 
        pr[node_id] = pr.at(node_id) / tmp_sum;

    double l1_norm;
    do {
        vector<double> new_pr(n, 0);
        double jump_val = 0.0;
        for (int node_id = 0; node_id < n; node_id++) {
            // Node* node = &(nodes.at(node_id));
            int node_degree = get_adj_num(node_id);
            double pr_val = pr.at(node_id);
            if (node_degree == 0) {
                jump_val += pr_val;
            } else {
                vector<int> adj_list = get_adj_list(node_id);
                for (auto itr = adj_list.begin(); itr != adj_list.end(); itr++) {
                    int adj_id = *itr;
                    new_pr[adj_id] += pr_val / node_degree;
                }
            }
        }
        l1_norm = 0;
        for (int node_id = 0; node_id < n; node_id++) {
            new_pr[node_id] += jump_val / n;
            l1_norm += abs(pr[node_id] - new_pr[node_id]);
            pr[node_id] = new_pr[node_id];
        }
    } while (l1_norm > epsilon);
    return pr;
}

vector<double> Graph::calc_degree_centrality() const {
    vector<double> node_to_degree, node_to_dc;
    int total_degree = 0;
    for (int node_id = 0; node_id < n; node_id++) {
        int degree = get_adj_num(node_id);
        total_degree += degree;
        node_to_degree.push_back((double)degree);
    }
    for (int node_id = 0; node_id < n; node_id++) {
        node_to_dc.push_back((double)node_to_degree.at(node_id) / total_degree);
    }
    return node_to_dc;
}

vector<double> Graph::get_distances_by_dijkstra(int source_id) const {
    vector<double> dist(n, numeric_limits<double>::max());
    dist[source_id] = 0;

    using P = pair<double, int>; // (距離, ノードID)
    priority_queue<P, vector<P>, greater<P>> pq;
    pq.emplace(0.0, source_id);

    while (!pq.empty()) {
        auto [d, u] = pq.top(); pq.pop();
        if (d > dist[u]) continue; // 古いエントリならスキップ

        for (int v : get_adj_list(u)) {
            if (dist[v] > dist[u] + 1) {
                dist[v] = dist[u] + 1;
                pq.emplace(dist[v], v);
            }
        }
    }

    return dist;
}

vector<pair<int, double>> Graph::get_ordered_ppr(map<int, double> ppr) const {
    vector<pair<int, double>> ppr_vec;
    for(auto itr = ppr.begin(); itr != ppr.end(); ++itr) {
        ppr_vec.push_back({itr->first, itr->second});
    }
    sort(ppr_vec.begin(), ppr_vec.end(),
        [](const pair<int, double> &l, const pair<int, double> &r)
        {
            if (l.second != r.second) {
                return l.second > r.second;
            }
            return l.first < r.first;
        });
    
    return ppr_vec;
}

// double Graph::r_max_func(int degree, double alpha, int walk_count, double r_max_coef) const {
//     return degree * r_max_coef / (alpha * walk_count);
// }

// bool Graph::get_is_directed() const {
//     return is_directed;
// }

void Graph::show_edge_list() const {
    cout << "edge_list" << endl;
    for (int node_id = 0; node_id < n; node_id++) {
        vector<int> adj_list = get_adj_list(node_id);
        for (auto itr = adj_list.begin(); itr != adj_list.end(); itr++) {
            cout << node_id << " " << *itr << endl;
        }
    }
    cout << endl;
}

int Graph::insert_edge(int src_id, int dst_id) {
    if (has_edge(src_id, dst_id)) return 0;

    adj_set_list.at(src_id).insert(dst_id);
    adj_list_list.at(src_id).push_back(dst_id);
    if (!is_directed) {
        adj_set_list.at(dst_id).insert(src_id);
        adj_list_list.at(dst_id).push_back(src_id);
        return 2;
    }
    return 1;
}

int Graph::remove_edge(int src_id, int dst_id) {
    // 削除エッジの存在確認
    if (!has_edge(src_id, dst_id)) return 0;

    adj_set_list.at(src_id).erase(dst_id);
    auto it = find(adj_list_list.at(src_id).begin(), adj_list_list.at(src_id).end(), dst_id);
    assert(it != adj_list_list.at(src_id).end());
    int removed_suf = distance(adj_list_list.at(src_id).begin(), it);
    adj_list_list.at(src_id)[removed_suf] = adj_list_list.at(src_id).back();
    adj_list_list.at(src_id).pop_back();
    
    if (!is_directed) {
        adj_set_list.at(dst_id).erase(src_id);
        auto it = find(adj_list_list.at(dst_id).begin(), adj_list_list.at(dst_id).end(), src_id);
        assert(it != adj_list_list.at(dst_id).end());
        int removed_suf = distance(adj_list_list.at(dst_id).begin(), it);
        adj_list_list.at(dst_id)[removed_suf] = adj_list_list.at(dst_id).back();
        adj_list_list.at(dst_id).pop_back();
        return 2;
    }
    return 1;
}

// int Graph::remove_node(int node_id) {
//     int removed_edge_count = 0;
//     for (int adj_id : get_adj_list(node_id)) {
//         removed_edge_count += remove_edge(node_id, adj_id);
//     }
//     return removed_edge_count;
// }

vector<pair<int, int>> Graph::load_edge_list() const {
    vector<pair<int, int>> edge_list;
    fstream file;
    string line;
    char splitter = ' ';
    string file_path = "./data/indexed_edges.txt";
    file.open(file_path, ios::in);
    assert(file.is_open());
    string edge_str;
    while (getline(file, line)) {
        stringstream ss{line};
        int src_id, dst_id;
        getline(ss, edge_str, splitter);
        src_id = stoi(edge_str);
        getline(ss, edge_str, splitter);
        dst_id = stoi(edge_str);
        if (src_id == dst_id) continue; // ignore self-loop
        edge_list.push_back(make_pair(src_id, dst_id));
    }
    file.close();

    return edge_list;
}

// int Graph::get_initial_edge_count() const {
    // return initial_edge_count;
// }

// bool Graph::get_is_dynamic() const {
//     return is_dynamic;
// }

void Graph::show_graph_size_in_kb() const {
    long long byte = 0;
    byte += sizeof(adj_list_list);
    for (vector<int> adj_list : adj_list_list) {
        byte += sizeof(adj_list);
        byte += sizeof(int) * adj_list.size();
    }

    byte += sizeof(adj_set_list);
    for (unordered_set<int> adj_set : adj_set_list) {
        byte += sizeof(adj_set);
        byte += sizeof(int) * adj_set.size();
    }

    cout << "graph\t" << byte / 1000 << " [KB]" << endl;
}

bool Graph::has_edge(int src_id, int dst_id) const {
    if (adj_set_list.at(src_id).count(dst_id) == 0) {
        if (!is_directed) assert(adj_set_list.at(dst_id).count(src_id) == 0);
        return false;
    }
    if (!is_directed) assert(adj_set_list.at(dst_id).count(src_id) != 0);
    return true;
}

void Graph::save_graph_to_file() {
    // save adj_list_list
    string filename = string(getenv("HOME")) + "/graph_binary/" + data_dir + "/adj_list_list.bin";
    std::ofstream ofs(filename, std::ios::binary);

    if (!ofs) {
        std::cerr << "Failed to open file for writing: " << filename << std::endl;
        return;
    }

    size_t outerSize = adj_list_list.size();
    ofs.write(reinterpret_cast<const char*>(&outerSize), sizeof(outerSize));

    for (const auto& vec : adj_list_list) {
        size_t innerSize = vec.size();
        ofs.write(reinterpret_cast<const char*>(&innerSize), sizeof(innerSize));
        ofs.write(reinterpret_cast<const char*>(vec.data()), innerSize * sizeof(int));
    }

    ofs.close();

    // save adj_set_list
    string filename2 = string(getenv("HOME")) + "/graph_binary/" + data_dir + "/adj_set_list.bin";
    std::ofstream ofs2(filename2, std::ios::binary);

    if (!ofs2) {
        std::cerr << "Failed to open file for writing: " << filename2 << std::endl;
        return;
    }

    size_t vectorSize = adj_set_list.size();
    ofs2.write(reinterpret_cast<const char*>(&vectorSize), sizeof(vectorSize));

    for (const auto& uset : adj_set_list) {
        size_t setSize = uset.size();
        ofs2.write(reinterpret_cast<const char*>(&setSize), sizeof(setSize));
        for (const auto& item : uset) {
            ofs2.write(reinterpret_cast<const char*>(&item), sizeof(item));
        }
    }

    ofs2.close();
}

void Graph::load_graph_from_binary() {
    // load adj_list_list
    {
        string filename = string(getenv("HOME")) + "/graph_binary/" + data_dir + "/adj_list_list.bin";
        std::ifstream ifs(filename, std::ios::binary);

        if (!ifs) {
            std::cerr << "Failed to open file for reading: " << filename << std::endl;
            return;
        }

        size_t outerSize;
        ifs.read(reinterpret_cast<char*>(&outerSize), sizeof(outerSize));
        adj_list_list.clear();
        adj_list_list.resize(outerSize);

        for (auto& vec : adj_list_list) {
            size_t innerSize;
            ifs.read(reinterpret_cast<char*>(&innerSize), sizeof(innerSize));
            vec.resize(innerSize);
            ifs.read(reinterpret_cast<char*>(vec.data()), innerSize * sizeof(int));
        }

        ifs.close();
    }
    // load adj_set_list
    {
        string filename = string(getenv("HOME")) + "/graph_binary/" + data_dir + "/adj_set_list.bin";
        std::ifstream ifs(filename, std::ios::binary);

        if (!ifs) {
            std::cerr << "Failed to open file for reading: " << filename << std::endl;
            return;
        }

        size_t vectorSize;
        ifs.read(reinterpret_cast<char*>(&vectorSize), sizeof(vectorSize));
        adj_set_list.clear();
        adj_set_list.resize(vectorSize);

        for (auto& uset : adj_set_list) {
            size_t setSize;
            ifs.read(reinterpret_cast<char*>(&setSize), sizeof(setSize));
            for (size_t i = 0; i < setSize; ++i) {
                int item;
                ifs.read(reinterpret_cast<char*>(&item), sizeof(item));
                uset.insert(item);
            }
        }

        ifs.close();
    }
}

void Graph::_load_attribute() {
    fstream file;
    char splitter = ' ';
    string attribute_file_path = "./data/attributes.txt";
    file.open(attribute_file_path, ios::in);
    assert(file.is_open());
    string line, attribute, val;
    bool error_flag = false;
    while (getline(file, line)) {
        stringstream ss{line};
        getline(ss, attribute, splitter);
        if (attribute == "n") {
            getline(ss, val, splitter);
            n = stoi(val);
        } else if (attribute == "is_directed") {
            getline(ss, val, splitter);
            if (val == "true") is_directed = true;
            else if (val == "false") is_directed = false;
            else error_flag = true;
        } else if (attribute == "is_dynamic") {
            getline(ss, val, splitter);
            if (val == "true") is_dynamic = true;
            else if (val == "false") is_dynamic = false;
            else error_flag = true;
        } else if (attribute == "initial_edge_count") {
            getline(ss, val, splitter);
            initial_edge_count = stoi(val);
        } else if (attribute == "is_weighted") {
            getline(ss, val, splitter);
            if (val == "true") is_weighted = true;
            else if (val == "false") is_weighted = false;
            else error_flag = true;
        } else if (attribute == "is_bipartite") {
            getline(ss, val, splitter);
            if (val == "true") is_bipartite = true;
            else if (val == "false") is_bipartite = false;
            else error_flag = true;
        }
        else error_flag = true;
    }
    file.close();
    assert(!error_flag);
}